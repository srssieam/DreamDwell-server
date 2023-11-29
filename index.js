const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const app = express();
const PORT = process.env.PORT || 5000;

// middleware
app.use(cors({
  origin: [
    'http://localhost:5173'
  ],
  credentials: true
}));
app.use(express.json())
app.use(cookieParser());

// middleware for user verification
const verifyToken = (req, res, next) => {
  const token = req?.cookies?.dreamDwell;   // get the cookie from client site
  // console.log('token in the middleware', token);
  // if no token available
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  // if token available 
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded; // get the user who have token
    next();
  })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.xjpiwvy.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const reviewsCollection = client.db("dream-dwell").collection("reviews");
    const usersCollection = client.db("dream-dwell").collection("users");
    const propertyCollection = client.db("dream-dwell").collection("properties");
    const advertisementCollection = client.db("dream-dwell").collection("advertisements");
    const wishlistCollection = client.db("dream-dwell").collection("wishlist");
    const offeredCollection = client.db("dream-dwell").collection("offeredProperties");



    //auth related api
    app.post('/v1/api/jwt', async (req, res) => {
      const loggedUser = req.body; // get the loggedUser from client site
      console.log('user for token', loggedUser);
      const token = jwt.sign(loggedUser, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5h' }) // generated a token for logged user

      res.cookie('dreamDwell', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none'
      })
      res.send({ success: true });
    })

    // delete the  cookie in client site
    app.post('/logout', async (req, res) => {
      const loggedUser = req.body;  // get loggedUser={}
      console.log('logging out', loggedUser)
      res.clearCookie('dreamDwell', { maxAge: 0 }).send({ success: true }) // clear the cookie
    })



    // reviews related api
    app.get('/v1/api/reviews', async (req, res) => {
      const title = req.query.propertyTitle;
      if (title) {
        const query = { property_title: title };
        const result = await reviewsCollection.find(query).sort({ _id: -1 }).toArray();
        res.send(result);
        return;
      }

      const result = await reviewsCollection.find().sort({ _id: -1 }).toArray();
      res.send(result);
    })

    app.get('/v1/api/myReviews', async (req, res) => {
      const name = req.query.reviewerName;
      const result = await reviewsCollection.find({ reviewer_name: name }).sort({ _id: -1 }).toArray();
      res.send(result)
    })

    app.delete('/v1/api/reviews/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await reviewsCollection.deleteOne(query);
      res.send(result);
    })

    app.post('/v1/api/reviews', async (req, res) => {
      const newReview = req.body;
      const result = await reviewsCollection.insertOne(newReview);
      res.send(result)
    })


    // user related api
    app.post('/v1/api/users', async (req, res) => {
      const user = req.body;

      // don't insert userInfo if user already exists
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query); // find user with the existing email
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null });
      }

      // insert userInfo if user doesn't exist
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })

    app.get('/v1/api/users', verifyToken, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    app.delete('/v1/api/users/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    })

    app.get('/v1/api/users/admin/:email', verifyToken, async(req, res)=>{
      const email = req.params.email;
      if(email !== req.user.email){
          return res.status(403).send({message: 'unauthorized access'})
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if(user){  //  if user.role === admin then result will be true
          admin = user?.role === 'admin';
      }
      res.send({ admin })
  })

    // update user to admin
    app.patch('/v1/api/users/admin/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })

    // update user to agent
    app.patch('/v1/api/users/agent/:id',verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'agent'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })

    // mark as fraud
    app.patch('/v1/api/users/fraud/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'fraud'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })


    // property related api
    app.get('/v1/api/properties', async (req, res) => {
      const result = await propertyCollection.find().toArray();
      res.send(result)
    })

    app.get('/v1/api/agentAddedProperties', verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { agent_email: email };
      const result = await propertyCollection.find(query).toArray();
      res.send(result);
    })

    app.delete('/v1/api/agentAddedProperties/:id', verifyToken, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) };
      const result = await propertyCollection.deleteOne(query);
      res.send(result);
    })

    app.get('/v1/api/agentAddedProperties/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) };
      const result = await propertyCollection.findOne(query);
      res.send(result);
    })

    app.patch('/v1/api/agentAddedProperties/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      // console.log(id)
      const property = req.body;
      // console.log(property)
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: property
      }
      const result = await propertyCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    app.post('/v1/api/agentAddedProperties', verifyToken, async (req, res) => {
      const newProperty = req.body;
      const result = await propertyCollection.insertOne(newProperty);
      res.send(result);
    })

    app.get('/v1/api/allVerifiedProperties', async (req, res) => {
      if (req.query?.search) {
        const filter = req.query.search;
        // console.log(filter);
        const query = {
          property_title: { $regex: filter, $options: 'i' }
        };
        const result = await propertyCollection.find(query).toArray();
        res.send(result);
        return;
      }
      const query = { verification_status: "verified" }
      const result = await propertyCollection.find(query).toArray();
      res.send(result)
    })

    app.get('/v1/api/allVerifiedProperties/:id', async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };
      res.send(await propertyCollection.findOne(query));
    })

    app.post('/v1/api/advertisement', verifyToken, async (req, res) => {
      const advertisement = req.body;
      // console.log(advertisement)
      const result = await advertisementCollection.insertOne(advertisement);
      res.send(result)
    })

    app.delete('/v1/api/advertisement/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: id };
      const result = await advertisementCollection.deleteOne(query);
      res.send(result);
    })

    app.get('/v1/api/advertisement', async (req, res) => {
      const result = await advertisementCollection.find().toArray()
      res.send(result)
    })

    app.delete('v1/api/properties/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await propertyCollection.deleteOne(query);
      res.send(result)
    })

    app.patch('/v1/api/properties/verify/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          verification_status: "verified"
        }
      }
      const result = await propertyCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })

    app.patch('/v1/api/properties/reject/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          verification_status: "rejected"
        }
      }
      const result = await propertyCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })

    app.delete('/v1/api/fraudProperty/:email', verifyToken, async (req, res) => {
      const fraudUser = req.params.email;
      // console.log(fraudUser)
      const query = { agent_email: fraudUser }
      const result = await propertyCollection.deleteMany(query);
      const result2 = await advertisementCollection.deleteMany(query);
      res.send([result, result2])
    })

    // wishlist related api
    app.post('/v1/api/wishlist', async (req, res) => {
      const wishlistProperty = req.body;
      // console.log(wishlistProperty)
      const result = await wishlistCollection.insertOne(wishlistProperty);
      res.send(result);
    })

    app.get('/v1/api/wishlist', verifyToken, async (req, res) => {
      const email = req.query.email;
      // console.log(email);
      // console.log('cookies from client site', req.cookies)  // get cookies from client site
      // console.log('token owner info', req.user.email)
      if(req.user.email !== req.query.email){  // compare between user email and email in data base
        return res.status(403).send({message: 'forbidden access'})
      }
      const query = { buyerEmail: email }
      const result = await wishlistCollection.find(query).toArray();
      res.send(result);
    })

    app.delete('/v1/api/wishlist/:id',verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: id }
      const result = await wishlistCollection.deleteOne(query)
      res.send(result);
    })

    app.get('/v1/api/wishlist/:id', async (req, res) => {
      const query = { _id: req.params.id };
      res.send(await wishlistCollection.findOne(query));
    })

    // offered properties
    app.post('/v1/api/allOfferedProperties', verifyToken, async (req, res) => {
      const offeredProperty = req.body;
      // console.log(wishlistProperty)
      const result = await offeredCollection.insertOne(offeredProperty);
      res.send(result);
    })

    app.get('/v1/api/usersOfferedProperties', verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { buyer_email: email }
      const result = await offeredCollection.find(query).toArray();
      res.send(result);
    })

    app.get('/v1/api/usersOfferedProperties/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: id }
      const result = await offeredCollection.find(query).toArray();
      res.send(result);
    })

    app.get('/v1/api/allOfferedProperties', verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { buyer_email: email }
      const result = await offeredCollection.find(query).toArray();
      res.send(result);
    })


    app.patch('/v1/api/allOfferedProperties/paid/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: id }
      const updatedDoc = {
        $set: {
          status: "Paid"
        }
      }
      const result = await offeredCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })

    app.patch('/v1/api/offeredProperties/accept/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: id }
      const updatedDoc = {
        $set: {
          status: "accepted"
        }
      }
      const result = await offeredCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })

    app.patch('/v1/api/offeredProperties/reject/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: id }
      const updatedDoc = {
        $set: {
          status: "rejected"
        }
      }
      const result = await offeredCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })


    // payment intent
    app.post('/v1/api/create-payment-intent', async (req, res) => {
      const { price } = req.body;  // get price from client
      console.log(price)
      const amount = parseInt(price * 100); // convert tk into poisa
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      })

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Dream Dwell server is running')
})

app.listen(PORT, () => {
  console.log(`DreamDwell server is running on http://localhost:${PORT}`)
})