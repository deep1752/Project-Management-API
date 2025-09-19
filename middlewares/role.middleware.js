const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Task = require('../models/Task');
const Project = require('../models/Project');

// --- AUTHENTICATION ---

// Middleware to verify JWT and attach user to request
const authenticate = asyncHandler(async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      res.status(401);
      throw new Error('Authorization token missing');
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Support different payload formats (userId, id, _id)
    const userId = decoded.userId || decoded.id || decoded._id;
    if (!userId) {
      res.status(401);
      throw new Error('Invalid token payload: no userId');
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      res.status(401);
      throw new Error('User not found');
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401);
    throw new Error('Invalid or expired token');
  }
});

// --- ROLE-BASED ACCESS CONTROL ---

// Middleware for Admin role
const adminMiddleware = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'Admin') {
    res.status(403);
    throw new Error('Forbidden: Admin role required');
  }
  next();
});

// Middleware for Project Manager or Owner roles
const isProjectManager = asyncHandler(async (req, res, next) => {
  const user = req.user;
  if (user.role === 'Admin') return next(); // Admin bypass

  let projectId =
    req.params.projectId || req.params.id || req.body.projectId;

  if (!projectId) {
    res.status(400);
    throw new Error('Project ID not provided for role check');
  }

  const project = await Project.findById(projectId).lean();
  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  const isOwner = String(project.owner) === String(user._id);
  const isProjectManagerRole = (project.members || []).some(
    (m) => String(m.user) === String(user._id) && m.role === 'Project Manager'
  );

  if (!isOwner && !isProjectManagerRole) {
    res.status(403);
    throw new Error('Forbidden: Project Manager or Owner role required');
  }

  req.project = project;
  next();
});

// Middleware for Member role
const memberMiddleware = asyncHandler(async (req, res, next) => {
  const user = req.user;
  if (user.role === 'Admin') return next(); // Admin bypass

  let projectId =
    req.params.projectId || req.params.id || req.body.projectId;

  if (!projectId) {
    res.status(400);
    throw new Error('Project ID not provided for role check');
  }

  const project = await Project.findById(projectId).lean();
  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  const isMember =
    (project.members || []).some((m) => String(m.user) === String(user._id)) ||
    String(project.owner) === String(user._id);

  if (!isMember) {
    res.status(403);
    throw new Error('Forbidden: User is not a member of this project');
  }

  req.project = project;
  next();
});

// --- TASK ACCESS CONTROL ---

// Admin or any project member
const checkProjectAccessForTask = asyncHandler(async (req, res, next) => {
  const user = req.user;
  let projectId;

  if (req.params.projectId) {
    projectId = req.params.projectId;
  } else if (req.params.id) {
    const task = await Task.findById(req.params.id).lean();
    if (!task) {
      res.status(404);
      throw new Error('Task not found.');
    }
    projectId = task.project;
    req.task = task;
  } else if (req.body.taskId) {
    const task = await Task.findById(req.body.taskId).lean();
    if (!task) {
      res.status(404);
      throw new Error('Task not found.');
    }
    projectId = task.project;
    req.task = task;
  } else {
    res.status(400);
    throw new Error('Project ID or Task ID not provided for access check.');
  }

  const project = await Project.findById(projectId).lean();
  if (!project) {
    res.status(404);
    throw new Error('Project not found.');
  }

  const isAdmin = user.role === 'Admin';
  const isMember =
    (project.members || []).some((m) => String(m.user) === String(user._id)) ||
    String(project.owner) === String(user._id);

  if (!isAdmin && !isMember) {
    res.status(403);
    throw new Error(
      'Forbidden: User is not a member of this project or an Admin.'
    );
  }

  req.project = project;
  next();
});

// Admin, PM, or Owner
const projectManagerTaskAccess = asyncHandler(async (req, res, next) => {
  const user = req.user;
  let projectId;

  if (req.params.projectId) {
    projectId = req.params.projectId;
  } else if (req.params.id) {
    const task = await Task.findById(req.params.id).lean();
    if (!task) {
      res.status(404);
      throw new Error('Task not found.');
    }
    projectId = task.project;
    req.task = task;
  } else if (req.body.taskId) {
    const task = await Task.findById(req.body.taskId).lean();
    if (!task) {
      res.status(404);
      throw new Error('Task not found.');
    }
    projectId = task.project;
    req.task = task;
  } else {
    res.status(400);
    throw new Error('Project ID or Task ID not provided for access check.');
  }

  const project = await Project.findById(projectId).lean();
  if (!project) {
    res.status(404);
    throw new Error('Project not found.');
  }

  const isAdmin = user.role === 'Admin';
  const isOwner = String(project.owner) === String(user._id);
  const isProjectManagerRole = (project.members || []).some(
    (m) => String(m.user) === String(user._id) && m.role === 'Project Manager'
  );

  if (!isAdmin && !isOwner && !isProjectManagerRole) {
    res.status(403);
    throw new Error(
      'Forbidden: User is not an Admin, Project Manager, or Owner of this project.'
    );
  }

  req.project = project;
  next();
});

// Assignee only
const checkAssigneeOfTask = asyncHandler(async (req, res, next) => {
  const user = req.user;
  const taskId = req.params.id || req.body.taskId;

  if (!taskId) {
    res.status(400);
    throw new Error('Task ID not provided for access check.');
  }

  const task = await Task.findById(taskId).lean();
  if (!task) {
    res.status(404);
    throw new Error('Task not found.');
  }

  const isAssignee =
    task.assignee && String(task.assignee) === String(user._id);

  if (!isAssignee) {
    res.status(403);
    throw new Error('Forbidden: User is not the assignee of this task.');
  }

  req.task = task;
  next();
});

// Composite: Admin = full access, PM/Owner = project tasks, Member = assigned tasks only
const authorizeTaskAccess = asyncHandler(async (req, res, next) => {
  const user = req.user;
  const taskId = req.params.id || req.body.taskId;

  if (!taskId) {
    res.status(400);
    throw new Error('Task ID not provided for access check.');
  }

  const task = await Task.findById(taskId);
  if (!task) {
    res.status(404);
    throw new Error('Task not found.');
  }

  const project = await Project.findById(task.project).lean();
  if (!project) {
    res.status(404);
    throw new Error('Project not found for this task.');
  }

  const isAdmin = user.role === 'Admin';
  const isOwner = String(project.owner) === String(user._id);
  const isProjectManagerRole = (project.members || []).some(
    (m) => String(m.user) === String(user._id) && m.role === 'Project Manager'
  );
  const isAssignee =
    task.assignee && String(task.assignee) === String(user._id);

  if (isAdmin || isOwner || isProjectManagerRole || isAssignee) {
    req.project = project;
    req.task = task;
    next();
  } else {
    res.status(403);
    throw new Error(
      'Forbidden: Insufficient permissions to view or edit this task.'
    );
  }
});

// Delete: Admin, PM, or Owner
const canDeleteTask = asyncHandler(async (req, res, next) => {
  const user = req.user;
  const taskId = req.params.id || req.body.taskId;

  if (!taskId) {
    res.status(400);
    throw new Error('Task ID not provided for access check.');
  }

  const task = await Task.findById(taskId);
  if (!task) {
    res.status(404);
    throw new Error('Task not found.');
  }

  const project = await Project.findById(task.project).lean();
  if (!project) {
    res.status(404);
    throw new Error('Project not found for this task.');
  }

  const isAdmin = user.role === 'Admin';
  const isOwner = String(project.owner) === String(user._id);
  const isProjectManagerRole = (project.members || []).some(
    (m) => String(m.user) === String(user._id) && m.role === 'Project Manager'
  );

  if (isAdmin || isOwner || isProjectManagerRole) {
    req.project = project;
    req.task = task;
    next();
  } else {
    res.status(403);
    throw new Error(
      'Forbidden: Only Admins, Project Managers, or Owners can delete tasks.'
    );
  }
});

module.exports = {
  authenticateUser: authenticate,
  adminMiddleware,
  projectManagerMiddleware: isProjectManager,
  memberMiddleware,
  checkProjectAccessForTask,
  projectManagerTaskAccess,
  checkAssigneeOfTask,
  authorizeTaskAccess,
  canDeleteTask,
};
