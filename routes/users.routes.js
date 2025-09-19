const express = require('express');
const router = express.Router();
const { listUsers, getUser, updateUser, deleteUser } = require('../controllers/user.controller');
const authenticate = require('../middlewares/auth.middleware');
const { adminMiddleware } = require('../middlewares/role.middleware');

// Admin-only routes
router.use(authenticate);
router.use(adminMiddleware);

router.get('/', listUsers);
router.get('/:id', getUser);

router.put('/update/:id', updateUser);
router.delete('/delete/:id', deleteUser);

module.exports = router;
