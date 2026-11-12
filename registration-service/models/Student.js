const mongoose = require('mongoose');

// Database schema for the assignment (exact field names):
// Student_id, Student_name, student_mobile, student_email, student_password
// The password is stored as a bcrypt hash and is excluded from queries by default.
const studentSchema = new mongoose.Schema(
  {
    Student_id: {
      type: String,
      required: [true, 'Student_id is required'],
      unique: true,
      trim: true,
      match: [/^[A-Za-z0-9_-]{3,30}$/, 'Student_id must be 3-30 letters, numbers, - or _'],
    },
    Student_name: {
      type: String,
      required: [true, 'Student_name is required'],
      trim: true,
      minlength: [2, 'Student_name must contain at least 2 characters'],
      maxlength: [100, 'Student_name is too long'],
    },
    student_mobile: {
      type: String,
      required: [true, 'student_mobile is required'],
      trim: true,
    },
    student_email: {
      type: String,
      required: [true, 'student_email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    student_password: {
      type: String,
      required: [true, 'student_password is required'],
      select: false,
    },
  },
  {
    collection: 'students',
    timestamps: true,
    versionKey: false,
  }
);

module.exports =
  mongoose.models.Student || mongoose.model('Student', studentSchema, 'students');
