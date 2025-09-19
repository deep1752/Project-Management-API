const Joi = require('joi');
const User = require('../models/User'); // Import User model to check roles
const Project = require('../models/Project'); // Import Project model for member count check

const ObjectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/, 'User ID').messages({
  'string.pattern.base': 'User ID must be a valid 24-character hexadecimal string.'
});

// Custom validator for ensuring exactly one Project Manager
const validateProjectManagers = (members, helpers) => {
  if (!members || members.length === 0) {
    return helpers.error('any.invalid', { message: 'Project must have at least one Project Manager.' });
  }
  const projectManagerCount = members.filter(member => member.role === 'Project Manager').length;

  // If Project Managers are present in the provided list, there must be exactly one.
  // If no Project Managers are present, this check passes, and the controller logic will enforce the overall count.
  if (projectManagerCount > 0 && projectManagerCount !== 1) {
    return helpers.error('any.invalid', { message: 'Project must have exactly one Project Manager.' });
  }

  return members;
};

const createProjectSchema = Joi.object({
  name: Joi.string().min(1).required(),
  description: Joi.string().allow(''),
  status: Joi.string().valid('active', 'archived'),
  owner: ObjectId.required(),
  members: Joi.array().items(Joi.object({
    user: ObjectId.required(),
    role: Joi.string().valid('Project Manager', 'Member').required().messages({
      'any.only': 'Member role must be either "Project Manager" or "Member".'
    })
  })).optional().custom(validateProjectManagers)
});

const assignMembersSchema = Joi.object({
  members: Joi.array().items(Joi.object({
    user: ObjectId.required(),
    role: Joi.string().valid('Project Manager', 'Member').required().messages({
      'any.only': 'Member role must be either "Project Manager" or "Member".'
    })
  })).min(1).required().custom(validateProjectManagers)
});

// Note: Validation for the owner's role ('Admin') will be handled in the controller
// as it requires fetching the user from the database.

module.exports = { createProjectSchema, assignMembersSchema };
