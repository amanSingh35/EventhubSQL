// Import dependencies
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cookieParser = require('cookie-parser');

// Load environment variables
dotenv.config();

const jwtSecret=process.env.SECRET_KEY;

// Create a new express app
const app = express();
const PORT = process.env.PORT || 5000;

// CORS Configuration
const corsOptions = {
   origin: 'http://localhost:5173', // Allow requests only from localhost:5173
   methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allow specific HTTP methods
   allowedHeaders: ['Content-Type', 'Authorization'], // Allow specific headers
   credentials: true, // Allow cookies or authorization headers to be sent
 };
 
 // Use CORS middleware with the defined options
 app.use(cors(corsOptions));
 app.use(cookieParser());
 app.use(express.json());
 app.use(express.urlencoded({ extended: true }));

// Set up the MySQL connection
const db = mysql.createConnection({
  host: process.env.DB_HOST, // Typically 'localhost' or your remote MySQL host
  user: process.env.DB_USER, // Your MySQL username
  password: process.env.DB_PASSWORD, // Your MySQL password
  database: process.env.DB_NAME // Your MySQL database name
});

// Connect to the database
db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    process.exit(1);
  } else {
    console.log('Connected to the MySQL database');
  }
});

// Set up multer for image upload
const storage = multer.diskStorage({
   destination: (req, file, cb) => {
     cb(null, 'uploads/'); // Store images in 'uploads' directory
   },
   filename: (req, file, cb) => {
     cb(null, Date.now() + path.extname(file.originalname)); // Use unique filenames
   },
 });
 
 const upload = multer({ storage: storage });
 

// Sample route to check if the server is running
app.get('/', (req, res) => {
  res.send('Welcome to EventHub API');
});

// **Create a new user**
app.post("/register", (req, res) => {
   const { name, email, password } = req.body;

   // Hash the password
   const hashedPassword = bcrypt.hashSync(password, 10); // Salt rounds = 10 by default

   // Prepare the query
   const query = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
   const values = [name, email, hashedPassword];

   // Execute the query
   db.query(query, values, (err, results) => {
       if (err) {
           console.error("Error inserting user:", err);
           return res.status(422).json(err);
       }

       // Create the user object to send in response
       const user = { id: results.insertId, name, email };
       res.json(user);
   });
});



// Login endpoint
app.post('/login', (req, res) => {
   const { email, password } = req.body;
   console.log(req.body);
 
   // Query to find the user by email
   const query = 'SELECT * FROM users WHERE email = ?';
   db.query(query, [email], (err, results) => {
     if (err) {
       return res.status(500).json({ error: 'Database error' });
     }
 
     if (results.length === 0) {
       // No user found with the given email
       return res.status(404).json({ error: 'User not found' });
     }
 
     const user = results[0];
 
     // Check the password
     const passOk = bcrypt.compareSync(password, user.password);
     if (!passOk) {
       return res.status(401).json({ error: 'Invalid password' });
     }
 
     // Generate a JWT token
     jwt.sign(
       {
         email: user.email,
         id: user.id,
       },
       jwtSecret,
       {},
       (err, token) => {
         if (err) {
           return res.status(500).json({ error: 'Failed to generate token' });
         }
         // Send the token in a cookie
         res
           .cookie('token', token, { httpOnly: true })
           .json({ id: user.id, email: user.email, name: user.name });
       }
     );
   });
 });

// **Get all users**
app.get('/users', (req, res) => {
  const query = 'SELECT * FROM users';
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching users:', err);
      return res.status(500).send('Error fetching users');
    }

    res.json(results); // Return the list of users in JSON format
  });
});


 
// Create Event Route
app.post('/createEvent', upload.single('image'), (req, res) => {
   const {
     owner, title, description, organizedBy, eventDate, eventTime,
     location, ticketPrice, likes
   } = req.body;
 
   // Get the image path from multer's file object
   const image = req.file ? req.file.path : null;
 
   const query = `
     INSERT INTO events (owner, title, description, organized_by, event_date, event_time, 
       location, ticket_price, likes, image) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
 
   db.query(query, [owner, title, description, organizedBy, eventDate, eventTime,
     location, ticketPrice, likes, image], (err, result) => {
     if (err) {
       console.error('Error inserting event:', err);
       return res.status(500).send('Error inserting event');
     }
 
     res.status(201).send({ id: result.insertId, title, eventDate });
   });
 });

 
// **Get all events**
app.get('/events', (req, res) => {
  const query = 'SELECT * FROM events';

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching events:', err);
      return res.status(500).send('Error fetching events');
    }

    res.json(results); // Return the events in JSON format
  });
});

app.get("/profile", async (req, res) => {
  try {
      const { token } = req.cookies || {}; // Handle undefined cookies
      // console.log(req.cookies);
      if (!token) {
          return res.status(401).json({ message: "Unauthorized", user: null });
      }

      // Verify the token
      jwt.verify(token, jwtSecret, {}, async (err, userData) => {
          if (err) {
              return res.status(403).json({ message: "Invalid token", user: null });
          }

          // Fetch user data using SQL
          const query = "SELECT id, name, email FROM users WHERE id = ?";
          db.query(query, [userData.id], (err, results) => {
              if (err) {
                  console.error("Error querying database:", err);
                  return res.status(500).json({ message: "Internal server error", user: null });
              }

              if (results.length === 0) {
                  return res.status(404).json({ message: "User not found", user: null });
              }
              //console.log(results[0]);
              const { id, name, email } = results[0];
              res.json({ name, email,id });
          });
      });

  } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ message: "Internal server error" });
  }
});


// **Create a new ticket**
app.post('/tickets', (req, res) => {
  const { userid, eventid, ticketDetails } = req.body;

  if (!ticketDetails) {
    return res.status(400).send("Missing ticket details");
  }

  const { name, email, eventname, eventdate, eventtime, ticketprice, qr } = ticketDetails;

  const query = `
    INSERT INTO tickets (user_id, event_id, name, email, event_name, event_date, event_time, ticket_price, qr) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    query, 
    [userid, eventid, name, email, eventname, eventdate, eventtime, ticketprice, qr],
    (err, result) => {
      if (err) {
        console.error('Error inserting ticket:', err);
        return res.status(500).send('Error inserting ticket');
      }

      res.status(201).send({ id: result.insertId, name, eventname });
    }
  );
});


// **Get all tickets**
app.get('/tickets', (req, res) => {
  const query = 'SELECT * FROM tickets';

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching tickets:', err);
      return res.status(500).send('Error fetching tickets');
    }

    res.json(results); // Return the tickets in JSON format
  });
});

app.get("/tickets/user/:userId", async (req, res) => {
  const userId = req.params.userId;

  try {
      const query = "SELECT * FROM tickets WHERE user_id = ?";
      db.query(query, [userId], (error, results) => {
          if (error) {
              console.error("Error fetching user tickets:", error);
              return res.status(500).json({ error: "Failed to fetch user tickets" });
          }

          // Check if results is an array (expected behavior)
          if (Array.isArray(results)) {
              res.json(results); // Send the array directly
          } else {
              console.error("Unexpected response format for tickets:", results);
              res.status(500).json({ error: "Unexpected error fetching user tickets" });
          }
      });
  } catch (error) {
      console.error("Unexpected error fetching user tickets:", error);
      res.status(500).json({ error: "An unexpected error occurred" });
  }
});

//**Getting the ticket by id */
app.delete("/tickets/:id", async (req, res) => {
  const ticketId = req.params.id;

  try {
     db.query("DELETE FROM tickets WHERE id = ?", [ticketId]);
    res.status(204).send(); // No Content
  } catch (error) {
    console.error("Error deleting ticket:", error);
    res.status(500).json({ error: "Failed to delete ticket" });
  }
});

//*Getting the event */
app.get("/event/:id", (req, res) => {
  const { id } = req.params;

  // SQL query to fetch event by id
  const query = "SELECT * FROM events WHERE id = ?";

  db.query(query, [id], (err, result) => {
     if (err) {
        console.error("Error fetching event:", err);
        return res.status(500).json({ error: "Failed to fetch event from the database" });
     }

     if (result.length === 0) {
        return res.status(404).json({ error: "Event not found" });
     }
     //console.log(result);
     res.json(result[0]); // Send the event object
  });
});
//*after clicking the book teckts add names and all. */
app.get("/event/:id/ordersummary", async (req, res) => {
  const { id } = req.params; // Extract the event ID from the route parameters

  try {
     // Query the database to fetch the event details by its ID
     const [event] = await db.promise().query(
        "SELECT * FROM events WHERE id = ?",
        [id]
     );

     // If no event is found, return a 404 error
     if (event.length === 0) {
        return res.status(404).json({ error: "Event not found" });
     }

     // Respond with the event details
     res.json(event[0]);
  } catch (error) {
     console.error("Error fetching event:", error);
     res.status(500).json({ error: "Failed to fetch event from the database" });
  }
});

//**after clicking the terms and conditions page */
app.get("/event/:id/ordersummary/paymentsummary", async (req, res) => {
  const { id } = req.params; // Extract the event ID from the route parameters

  try {
     // Query the database to fetch the event details by its ID
     const [event] = await db.promise().query(
        "SELECT * FROM events WHERE id = ?",
        [id]
     );

     // If no event is found, return a 404 error
     if (event.length === 0) {
        return res.status(404).json({ error: "Event not found" });
     }

     // Respond with the event details
     res.json(event[0]);
  } catch (error) {
     console.error("Error fetching event:", error);
     res.status(500).json({ error: "Failed to fetch event from the database" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
