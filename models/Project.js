const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['Project Manager', 'Member'], default: 'Member' }
}, { _id: false });

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  description: { type: String, default: '' },
  status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  members: [memberSchema],
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
});

// keep updatedAt updated
projectSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Project', projectSchema);
