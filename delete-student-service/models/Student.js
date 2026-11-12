const mongoose = require('mongoose');

// Both data services read/write the same "students" collection. Keeping the
// schema identical in each service also means each container is independent.
const studentSchema = new mongoose.Schema(
  {
    Student_id: {
      type: String,
      required: [true, 'Student_id is required'],
      unique: true,
      trim: true,
    },
    Student_name: {
      type: String,
      required: [true, 'Student_name is required'],
      trim: true,
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
