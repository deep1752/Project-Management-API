const asyncHandler = require('express-async-handler');
const User = require('../models/User');


// Admin-only: list users
const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select('-password');
  res.json(users);
});



// Admin-only: get single user
const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
    res.json(user);
});



// Admin-only: update user
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }


  const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).select('-password');

  res.json(updatedUser);
});



// Admin-only: delete user
const deleteUser = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const user = await User.findById(userId);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Check if the user is an owner or member of any projects
  const ownedProjects = await Project.findOne({ owner: userId });
  const memberProjects = await Project.findOne({ 'members.user': userId });

  if (ownedProjects || memberProjects) {
    res.status(400);
    throw new Error('Cannot delete user: User is associated with projects.');
  }

  // Check if the user is assigned to any tasks
  const assignedTasks = await Task.findOne({ assignee: userId });

  if (assignedTasks) {
    res.status(400);
    throw new Error('Cannot delete user: User is assigned to tasks.');
  }

  await User.deleteOne({ _id: userId });
  res.json({ message: 'User removed successfully' });
});


module.exports = { listUsers, getUser, updateUser, deleteUser };
