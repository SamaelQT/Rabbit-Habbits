const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30 },
  email:    { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  displayName: { type: String, default: '' },
  friendCode: { type: String, unique: true, sparse: true },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  friendRequests: [{
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }],
  receivedFires: [{
    from:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fromName:  { type: String, default: '' },
    message:   { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    seen:      { type: Boolean, default: false }
  }],
  // Track who this user sent fire to today (reset automatically by date check)
  sentFires: [{
    to:     { type: mongoose.Schema.Types.ObjectId },
    sentAt: { type: Date, default: Date.now }
  }],
  receivedGifts: [{
    from:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fromName:  { type: String, default: '' },
    itemId:    { type: String, default: '' },
    itemName:  { type: String, default: '' },
    itemEmoji: { type: String, default: '' },
    qty:       { type: Number, default: 1 },
    createdAt: { type: Date, default: Date.now },
    seen:      { type: Boolean, default: false }
  }],
  lastSeen:    { type: Date, default: null },
  createdAt:   { type: Date, default: Date.now }
});

userSchema.pre('save', async function(next){
  if(!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function(plain){
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
