const Joi = require('joi');
const ObjectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/);

const createTaskSchema = Joi.object({
  title: Joi.string().min(1).required(),
  description: Joi.string().allow(''),
  status: Joi.string().valid('todo','in-progress','done'),
  priority: Joi.string().valid('low','medium','high'),
  dueDate: Joi.date().optional(),
  assignee: ObjectId.optional()
});

const updateTaskSchema = Joi.object({
  title: Joi.string().min(1).optional(),
  description: Joi.string().allow('').optional(),
  status: Joi.string().valid('todo','in-progress','done').optional(),
  priority: Joi.string().valid('low','medium','high').optional(),
  dueDate: Joi.date().optional(),
  assignee: ObjectId.allow(null).optional()
});

// 🔧 Middleware factory for validation
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.details.map(d => d.message),
      });
    }
    req.body = value; // assign validated/sanitized values
    next();
  };
}

module.exports = {
  createTaskSchema,
  updateTaskSchema,
  validateCreateTask: validate(createTaskSchema),
  validateUpdateTask: validate(updateTaskSchema),
};
