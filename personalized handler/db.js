// const mongoose = require('mongoose');

// // Define a schema for your data
// const userSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   age: { type: Number, required: true },
// });

// // Create a model based on the schema
// const User = mongoose.model('User', userSchema);

// // Export the model
// module.exports = User;

// const mongoose = require('mongoose');
// const User = require('./userModel'); // Import the User model

// // Connect to MongoDB
// mongoose.connect('mongodb://localhost:27017/yourDatabaseName', { useNewUrlParser: true, useUnifiedTopology: true })
//   .then(() => {
//     console.log('Connected to MongoDB');

//     // Create a new user document
//     const newUser = new User({
//       name: 'John',
//       age: 30,
//     });

//     // Save the user document to the database
//     newUser.save()
//       .then(() => {
//         console.log('User created successfully');
//       })
//       .catch(error => {
//         console.error('Error creating user:', error);
//       });
//   })
//   .catch(error => {
//     console.error('Error connecting to MongoDB:', error);
//   });
