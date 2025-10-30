const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
require('dotenv').config();
const stripe= require('stripe')(process.env.STRIPE_SECRET_KEY)
// ---------------------------------------------------------use midle ware
app.use(cors());
app.use(express.json());

//----------------------------------------mongodb-------------------------------------------------------//
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.BD_USER}:${process.env.DB_PASSWORD}@cluster0.qj5o1cz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    //await client.connect();
    // Send a ping to confirm a successful connection
    const userCollection = client.db('bistroFood').collection('users');
    const menuCollection = client.db('bistroFood').collection('menu');
    const reviewCollection = client.db('bistroFood').collection('reviews');
    const cartCollection = client.db('bistroFood').collection('carts');
    const paymentCollection = client.db('bistroFood').collection('payment');
    // ------------------------------------------------------------jwt token api
    app.post('/jwt',async(req,res) => {
      const user = req.body;
      const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{expiresIn: '1h'});
      res.send({token});
    })
    // ------------------------------------------------------------middlewarew jwt
    const verifyToken = (req,res,next) => {
      if(!req.headers.authorization){
        return res.status(401).send({message: 'forbidden access'})
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded) => {
        if(err){
          return res.status(401).send({message: 'forbidden access'})
        }
        req.decoded = decoded;
      })
      next();
    }
    // ---------------------------------------------use verify admin after verify token
    const vefiAdmin = async(req,res,next) => {
      const email = req.decoded.email;
      const query = {email: email};
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if(!isAdmin){
          return res.status(403).send({message: 'forbidden access'})
      }
      next();
    }
    // -----------------------------------------------------users related api
    app.get('/users',verifyToken, async(req,res) => {

      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.get('/users/admin/:email',verifyToken,vefiAdmin,async(req,res) => {
      const email = req.params.email;
      if(email !== req.decoded.email){
        return res.status(403).send({message: 'unauthorized access'});
      }
      const query = {email: email};
      const user = await userCollection.findOne(query);
      let admin = false;
      if(user){
        admin = user?.role === "admin";
      }
      res.send({admin});
    })
   
    app.post('/users', async(req,res) => {
      const user = req.body;
      const query = {email: user.email};
      const existingUser = await userCollection.findOne(query);
      if(existingUser){
        return res.send({message: "user already exist", insertedId: null})
      }
      const result = await userCollection.insertOne(user);
      res.send(result)
    })
    app.patch('/users/admin/:id', async(req,res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updatedDoc = {
        $set: {
          role : 'admin'
        }
      }
      const result = await userCollection.updateOne(filter,updatedDoc);
      res.send(result);
    })
    app.delete('/users/:id',async(req,res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })
    //--------------------------------------------------------menu relative api
    app.get('/menu', async(req,res) => {
        const result = await menuCollection.find().toArray();
        res.send(result);
    });
    app.get('/menu/:id',async(req,res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await menuCollection.findOne(query);
      res.send(result);
    })
    app.post('/menu', async(req,res) => {
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result)
    });
    app.delete('/menu/:id',verifyToken,vefiAdmin,async(req,res) => {
      const id = req.params.id;
      const query = {_id: id};
      const queryOne = {_id: new ObjectId(id)};
      const result = await menuCollection.deleteOne(query);
      const result1 = await menuCollection.deleteOne(queryOne);
      res.send({result,result1});
    });
    app.patch('/menu/:id', async(req,res) => {
      const id = req.params.id;
      const item =req.body;
      console.log(item);
      const query = {_id: new ObjectId(id)};
      console.log(query);
      const updatedDoc = {
        $set : {
              name : item.name,
              category: item.category,
              price : item.price,
      }};
      const result = await menuCollection.updateOne(query,updatedDoc);
      console.log(result)
      res.send(result);

    })
    //----------------------------------------------------revieW collection
    app.get('/review', async(req,res) => {
        const result = await reviewCollection.find().toArray();
        res.send(result);
    });
    //----------------------------------------------------carts collection
    app.get('/carts', async(req,res) =>{
      const email = req.query.email;
      const query = {email: email};
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    })
    app.post('/carts',async (req,res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    })
    app.delete('/carts/:id',async(req,res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })
    //-----------------------------------------------------Payment intent
    app.post('/create-payment-intent', async(req,res) => {
      const {price} = req.body;
      const amount = parseInt(price*100);
      console.log(amount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });
      app.post('/payment', async(req,res) => {
        const payment = req.body;
        const paymentResult = await paymentCollection.insertOne(payment);
         //carefuly delete from data base
         const query = {_id: {
          $in : payment.cartIds.map(id => new ObjectId(id))
         }};
         const deleteResult =await cartCollection.deleteMany(query);
        console.log('payment info',payment);
        res.send({paymentResult,deleteResult});
      });
     
      app.get('/payments/:email',verifyToken,vefiAdmin,async(req,res) => {
        const query = {email : req.params.email};
        if(req.params.email !== req.decoded.email){
          return res.send(403).send({message : 'forbidden'})
        }
        const result = await paymentCollection.find(query).toArray();
        res.send(result);
      })

      res.send({
        clientSecret : paymentIntent.client_secret
      })
    })
     //stats or analytics
      app.get('/admin-stats',verifyToken,vefiAdmin,async(req,res) => {
        const users = await userCollection.estimatedDocumentCount();
        const menuItems = await menuCollection.estimatedDocumentCount();
        const orders = await paymentCollection.estimatedDocumentCount();
        //this is not the best way
        const payments = await paymentCollection.find().toArray();
        //const revenue = payments.reduce((total, payment) => total + payment.price,0)
        const result = await paymentCollection.aggregate([
          {
            $group : {
              _id : null,
              totalRvenue : {
                $sum : '$price'
              }
            }
          }
        ]).toArray();
        const revenue = result.length > 0 ? result[0].totalRvenue : 0;
        res.send({users,menuItems,orders,revenue})
      })
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);
//----------------------------------------mongodb-------------------------------------------------------//
app.get('/', (req,res) => {
    res.send('this is new serer')
});
module.exports = app;