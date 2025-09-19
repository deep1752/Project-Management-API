const asyncHandler = require('express-async-handler');
const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');

// --- Create task ---
const createTask = asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  const project = req.project;
  const data = req.body;

  // validate assignee
  if (data.assignee) {
    const assigneeUser = await User.findById(data.assignee);
    if (!assigneeUser) {
      res.status(400);
      throw new Error('Invalid assignee user ID');
    }

    const isAdmin = req.user.role === 'Admin';
    const isOwner = project && String(project.owner) === String(req.user._id);

    // If the current user is Admin or Owner, skip the membership check for assignee
    if (!isAdmin && !isOwner) {
      const isMember = project.members.some(
        (m) => String(m.user) === String(assigneeUser._id)
      );
      if (!isMember) {
        res.status(400);
        throw new Error('Assignee is not a member of this project');
      }
    }
  }

  const task = await Task.create({ ...data, project: projectId });
  res.status(201).json(task);
});

// --- List tasks for a project ---
const listTasks = asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  const { status, priority, assignee, page = 1, limit = 10 } = req.query;

  const project = req.project;
  const user = req.user;

  // Check if project is attached to the request by middleware
  if (!project) {
    res.status(404);
    throw new Error('Project not found or middleware failed to attach project.');
  }

  let q = { project: projectId };

  const isAdmin = user.role === 'Admin';
  const isOwner = String(project.owner) === String(user._id);
  const isPM = (project.members || []).some(
    (m) => String(m.user) === String(user._id) && m.role === 'Project Manager'
  );

  if (isAdmin || isOwner || isPM) {
    if (status) q.status = status;
    if (priority) q.priority = priority;
    if (assignee) q.assignee = assignee;
  } else {
    // Member → only their assigned tasks
    q.assignee = user._id;
  }

  const skip = (Math.max(Number(page), 1) - 1) * Number(limit);
  const tasks = await Task.find(q)
    .skip(skip)
    .limit(Number(limit))
    .populate('assignee', 'name email');
  const total = await Task.countDocuments(q);

  res.json({ data: tasks, total, page: Number(page), limit: Number(limit) });
});

// --- Get single task ---
const getTask = asyncHandler(async (req, res) => {
  res.json(req.task);
});

// --- Update task ---
const updateTask = asyncHandler(async (req, res) => {
  const updates = req.body;
  const task = await Task.findById(req.task._id);
  const project = req.project;

  // validate assignee change
  if (updates.assignee && String(task.assignee) !== String(updates.assignee)) {
    const assigneeUser = await User.findById(updates.assignee);
    if (!assigneeUser) {
      res.status(400);
      throw new Error('Invalid assignee');
    }
    const isMember = project.members.some(
      (m) => String(m.user) === String(assigneeUser._id)
    );
    if (!isMember) {
      res.status(400);
      throw new Error('Assignee must be project member');
    }

    const isAdmin = req.user.role === 'Admin';
    const isOwner = String(project.owner) === String(req.user._id);
    const isPM = (project.members || []).some(
      (m) => String(m.user) === String(req.user._id) && m.role === 'Project Manager'
    );

    if (!isAdmin && !isOwner && !isPM && String(updates.assignee) !== String(req.user._id)) {
      res.status(403);
      throw new Error('Members can only reassign tasks to themselves');
    }
  }

  Object.assign(task, updates);
  await task.save();
  res.json(task);
});

// --- Delete task ---
const deleteTask = asyncHandler(async (req, res) => {
  await req.task.deleteOne();
  res.json({ message: 'Task deleted' });
});

module.exports = {
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask,
};
