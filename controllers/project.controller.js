const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const User = require('../models/User'); 
const Project = require('../models/Project');
const Task = require('../models/Task');
const { createProjectSchema, assignMembersSchema } = require('../validations/project.validation');


const createProject = asyncHandler(async (req, res) => {
  const { error, value } = createProjectSchema.validate(req.body);
  if (error) {
    res.status(400);
    throw new Error(error.details[0].message);
  }
  const { name, description = '', status = 'active', owner, members = [], defaultTasks = [] } = value;

  // Validate that owner and member user IDs exist and their roles are consistent
  const memberUserIds = members.map(m => m.user);
  const allUserIdsProvided = [owner, ...memberUserIds];
  const uniqueUserIdsProvided = [...new Set(allUserIdsProvided)];

  const existingUsers = await User.find({ _id: { $in: uniqueUserIdsProvided.map(id => new mongoose.Types.ObjectId(id)) } });

  // Map users for quick lookup by ID
  const userMap = new Map(existingUsers.map(u => [u._id.toString(), u]));

  // Check if all provided IDs exist
  if (userMap.size !== uniqueUserIdsProvided.length) {
    const foundIds = new Set(Array.from(userMap.keys()));
    const invalidUserIds = uniqueUserIdsProvided.filter(id => !foundIds.has(id));
    res.status(400);
    throw new Error(`Invalid user ID(s) provided: ${invalidUserIds.join(', ')}`);
  }

  // Check owner's role
  const ownerUser = userMap.get(owner);
  if (!ownerUser || ownerUser.role !== 'Admin') {
    res.status(400);
    throw new Error('Project owner must have an Admin role.');
  }

  // Check consistency of member roles
  for (const member of members) {
    const user = userMap.get(member.user);
    // This check should ideally not fail due to the previous userMap.size check, but included for safety.
    if (!user) {
      res.status(400);
      throw new Error(`User ${member.user} not found.`);
    }

    if (member.role === 'Project Manager') {
      if (user.role !== 'Project Manager') {
        res.status(400);
        throw new Error(`User ${member.user} with role ${user.role} cannot be a Project Manager.`);
      }
    } else if (member.role === 'Member') {
      if (user.role !== 'Member') {
        res.status(400);
        throw new Error(`User ${member.user} with role ${user.role} cannot be a Member.`);
      }
    }
  } // <-- Closes the for loop for member role check.

  // Count Project Managers and enforce the limit
  let projectManagerCount = 0;
  for (const member of members) {
    if (member.role === 'Project Manager') {
      projectManagerCount++;
    }
  }

  if (projectManagerCount > 1) {
    res.status(400);
    throw new Error('Only one Project Manager is allowed per project.');
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // The 'members' array is already validated by Joi's custom validator for Project Manager count.
    const project = await Project.create([{ name, description, status, owner, members }], { session });
    // project is an array due to create([...])
    const proj = project[0];

    // create default tasks if provided
    if (Array.isArray(defaultTasks) && defaultTasks.length) {
      const tasksToInsert = defaultTasks.map(t => ({
        project: proj._id,
        title: t.title,
        description: t.description || '',
        status: t.status || 'todo',
        priority: t.priority || 'medium',
        dueDate: t.dueDate || null,
        assignee: t.assignee || null
      }));
      await Task.insertMany(tasksToInsert, { session });
    }

    await session.commitTransaction();
    session.endSession();

    const created = await Project.findById(proj._id).populate('members.user', 'name email');
    res.status(201).json(created);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});









// list projects with optional filter & pagination
const listProjects = asyncHandler(async (req, res) => {
  // filters: status, owner
  const { status, owner, page = 1, limit = 10, search } = req.query;
  const q = {};
  if (status) q.status = status;
  if (owner) q.owner = owner;
  if (search) q.name = { $regex: search, $options: 'i' };

  // if non-admin, show only projects where user is member or owner
  if (req.user.role !== 'Admin') {
    q.$or = [
      { owner: req.user._id },
      { 'members.user': req.user._id }
    ];
  }

  const skip = (Math.max(Number(page),1) - 1) * Number(limit);
  const projects = await Project.find(q).skip(skip).limit(Number(limit)).populate('owner', 'name email').populate('members.user', 'name email');
  const total = await Project.countDocuments(q);
  res.json({ data: projects, total, page: Number(page), limit: Number(limit) });
});






const getProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id).populate('owner', 'name email').populate('members.user', 'name email');
  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }
  // if not admin, verify membership
  if (req.user.role !== 'Admin') {
    // Check if the current user is a member of the project
    const member = (project.members || []).find(m => m.user && String(m.user._id) === String(req.user._id));
    // Check if the current user is the owner of the project
    const isOwner = project.owner && String(project.owner._id) === String(req.user._id);

    if (!member && !isOwner) { // If not a member AND not the owner
      res.status(403);
      throw new Error('Forbidden: not a member');
    }
  }
  res.json(project);
});




const updateProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  const { error, value } = createProjectSchema.validate(req.body);
  if (error) {
    res.status(400);
    throw new Error(error.details[0].message);
  }

  const { name, description = project.description, status = project.status, owner = project.owner, members = project.members } = value;

  // Validate that owner and member user IDs exist and their roles are consistent
  const memberUserIds = members.map(m => m.user);
  const allUserIdsProvided = [owner, ...memberUserIds];
  const uniqueUserIdsProvided = [...new Set(allUserIdsProvided)];

  const existingUsers = await User.find({ _id: { $in: uniqueUserIdsProvided.map(id => new mongoose.Types.ObjectId(id)) } });

  // Map users for quick lookup by ID
  const userMap = new Map(existingUsers.map(u => [u._id.toString(), u]));

  // Check if all provided IDs exist
  if (userMap.size !== uniqueUserIdsProvided.length) {
    const foundIds = new Set(Array.from(userMap.keys()));
    const invalidUserIds = uniqueUserIdsProvided.filter(id => !foundIds.has(id));
    res.status(400);
    throw new Error(`Invalid user ID(s) provided: ${invalidUserIds.join(', ')}`);
  }

  // Check owner's role
  const ownerUser = userMap.get(owner);
  if (!ownerUser || ownerUser.role !== 'Admin') {
    res.status(400);
    throw new Error('Project owner must have an Admin role.');
  }

  // Check consistency of member roles
  let projectManagerCount = 0;
  for (const member of members) {
    const user = userMap.get(member.user);
    if (!user) { // This check should ideally not fail due to the previous userMap.size check, but included for safety.
      res.status(400);
      throw new Error(`User ${member.user} not found.`);
    }

    if (member.role === 'Project Manager') {
      if (user.role !== 'Project Manager') {
        res.status(400);
        throw new Error(`User ${member.user} with role ${user.role} cannot be a Project Manager.`);
      }
      projectManagerCount++;
    } else if (member.role === 'Member') {
      if (user.role !== 'Member') {
        res.status(400);
        throw new Error(`User ${member.user} with role ${user.role} cannot be a Member.`);
      }
    }
  }

  // Enforce single Project Manager constraint (Joi's custom validator should have caught this, but double-checking here for safety)
  if (projectManagerCount !== 1) {
    res.status(400);
    throw new Error('Project must have exactly one Project Manager.');
  }

  // Update project fields
  project.name = name;
  project.description = description;
  project.status = status;
  project.owner = owner;
  project.members = members;

  await project.save();
  const updated = await Project.findById(project._id).populate('owner', 'name email').populate('members.user', 'name email');
  res.json(updated);
});





const deleteProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) {
    res.status(404);
    throw new Error('Product not found'); // Changed error message as requested
  }

  // remove project and its tasks atomically
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await Task.deleteMany({ project: project._id }, { session });
    await Project.deleteOne({ _id: project._id }, { session });
    await session.commitTransaction();
    session.endSession();
    res.json({ message: 'Project and tasks deleted' });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});






// assign members to project
const assignMembers = asyncHandler(async (req, res) => {
  const { error, value } = assignMembersSchema.validate(req.body);
  if (error) {
    res.status(400);
    throw new Error(error.details[0].message);
  }
  const project = await Project.findById(req.params.id);
  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  // Fetch incoming member users and create a role map
  const incomingMemberUserIds = value.members.map(m => m.user);
  const incomingMemberUsers = await User.find({ _id: { $in: incomingMemberUserIds.map(id => new mongoose.Types.ObjectId(id)) } });
  const incomingUserRoleMap = new Map(incomingMemberUsers.map(u => [u._id.toString(), u]));

  // Count existing project managers
  let existingProjectManagerCount = (project.members || []).filter(m => m.role === 'Project Manager').length; // Changed 'Manager' to 'Project Manager'

  // Validate member roles and count new project managers
  let newProjectManagerCount = 0;
  for (const member of value.members) {
    const user = incomingUserRoleMap.get(member.user);
    if (!user) {
        res.status(400);
        throw new Error(`User ${member.user} not found.`);
    }

    if (member.role === 'Project Manager') { // Changed 'Manager' to 'Project Manager'
      if (user.role !== 'Project Manager') {
        res.status(400);
        throw new Error(`User ${member.user} with role ${user.role} cannot be a Project Manager.`);
      }
      newProjectManagerCount++;
    } else if (member.role === 'Member') {
      if (user.role !== 'Member') {
        res.status(400);
        throw new Error(`User ${member.user} with role ${user.role} cannot be a Member.`);
      }
    }
  }

  // Enforce single Project Manager constraint
  if (existingProjectManagerCount + newProjectManagerCount > 1) {
    res.status(400);
    throw new Error('Only one Project Manager is allowed per project.');
  }

  // merge/update members
  const incoming = value.members;
  incoming.forEach(im => {
    const existingIndex = project.members.findIndex(m => String(m.user) === String(im.user));
    if (existingIndex >= 0) {
      project.members[existingIndex].role = im.role;
    } else {
      project.members.push(im);
    }
  });

  await project.save();
  res.json(await Project.findById(project._id).populate('members.user', 'name email'));
});

module.exports = {
  createProject, listProjects, getProject, updateProject, deleteProject, assignMembers
};
