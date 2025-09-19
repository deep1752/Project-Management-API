const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/auth.middleware');
const { adminMiddleware } = require('../middlewares/role.middleware');
const { createProject, listProjects, getProject, updateProject, deleteProject, assignMembers } = require('../controllers/project.controller');

// all routes require auth
router.use(authenticate);

router.post('/', adminMiddleware, createProject);

router.get('/', adminMiddleware, listProjects);

router.get('/:id', adminMiddleware, getProject);

router.put('/:id', adminMiddleware, updateProject);

router.delete('/:id', adminMiddleware, deleteProject);

router.post('/:id/assign', adminMiddleware, assignMembers);

module.exports = router;
