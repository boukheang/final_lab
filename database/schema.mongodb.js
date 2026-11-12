// Run with: mongosh "<MONGODB_URI>" database/schema.mongodb.js
// Creates the CLD_Final.students collection with validation and unique indexes.
const appDb = db.getSiblingDB("CLD_Final");

if (!appDb.getCollectionNames().includes("students")) {
  appDb.createCollection("students", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "Student_id",
          "Student_name",
          "student_mobile",
          "student_email",
          "student_password",
        ],
        properties: {
          Student_id: {
            bsonType: "string",
            description: "Unique student identifier",
          },
          Student_name: {
            bsonType: "string",
            description: "Student full name",
          },
          student_mobile: {
            bsonType: "string",
            description: "Student mobile number",
          },
          student_email: {
            bsonType: "string",
            description: "Unique student email",
          },
          student_password: {
            bsonType: "string",
            description: "bcrypt password hash",
          },
          createdAt: { bsonType: "date" },
          updatedAt: { bsonType: "date" },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });
}

appDb.students.createIndex({ Student_id: 1 }, { unique: true, name: "uniq_Student_id" });
appDb.students.createIndex({ student_email: 1 }, { unique: true, name: "uniq_student_email" });

print("CLD_Final.students schema and indexes are ready.");
printjson(appDb.students.getIndexes());
