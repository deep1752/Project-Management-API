const express = require('express');
const router = express.Router();

const taskController = require('../controllers/task.controller');
const {
    authenticateUser,
    projectManagerTaskAccess,
    authorizeTaskAccess,
    checkAssigneeOfTask,
    checkProjectAccessForTask,
    canDeleteTask
} = require('../middlewares/role.middleware');
const {
    validateCreateTask,
    validateUpdateTask,
} = require('../validations/task.validation');

// Authenticate all task routes
router.use(authenticateUser);

router.get('/projects/:projectId/tasks', projectManagerTaskAccess, taskController.listTasks);

router.get('/:id', authorizeTaskAccess, taskController.getTask);

router.post('/projects/:projectId/tasks', projectManagerTaskAccess, validateCreateTask, taskController.createTask);

router.put('/:id', authorizeTaskAccess, validateUpdateTask, taskController.updateTask);

router.delete('/:id', canDeleteTask, taskController.deleteTask);

module.exports = router;
