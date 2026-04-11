const express = require('express')
const cors = require('cors')
const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');


const app = express()
let dbConnected = false

app.use(cors())
app.use(express.json())

const port = process.env.PORT || 5000

const dbUser = process.env.DB_USER
const dbPassword = process.env.DB_PASSWORD
const dbHost = process.env.DB_HOST || 'cluster0.hm8fata.mongodb.net'
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${dbHost}/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    await client.connect();
    const database = client.db("NSTU_TaxDesk");
    const usersCollection = database.collection("users");
    const taxvatratesCollection = database.collection("taxvatrates");
    const paymentsCollection = database.collection("payments");
    const entitiesCollection = database.collection("entities");
    app.post('/users', async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.json(result);
    });
    app.get('/profile', async (req, res) => {
      const { email } = req.query;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.json(user);
    });
    app.get('/loginValidity',async(req,res)=>
    {
      const {email}=req.query;
      const query={email:email};
      const user=await usersCollection.findOne(query,{projection:{active:1}});
      if(!user)
      {
        return res.json({valid:false, message:'User not found'});
      }
      return res.json(user)

    })
    app.patch('/users/lastLogin',async(req,res)=>
    {
      const {email}=req.query;
      const query={email:email};
      const updateDoc={
        $set:{lastLogin:new Date()}
      }
      const result=await usersCollection.updateOne(query,updateDoc);
      res.json(result);

    })


    app.patch('/updateCalculationCount',async(req,res)=>
    {
      const {email}=req.query;
      const query={email:email};
      const result=await usersCollection.findOneAndUpdate(query,{$inc:{calculationCount:1}});
      res.json(result);

    })

    //Payment API
    app.post('/payments', async (req, res) => {
      const paymentInfo=req.body;
      const result = await paymentsCollection.insertOne(paymentInfo);
      res.json(result);

    });
    app.get('/pending-payments', async (req, res) => {
      const {email,search,category,sort} = req.query;
      const query={userEmail:email, status:'Pending'};
     if(search){
        query.name={$regex: search, $options: 'i'}; 

      }
      if(category)
      {
        query.category = category;
      }
      if(sort){
        if(sort==="newest"){
          sortOption={createdAt:-1};
        }
        else if(sort==="oldest"){
          sortOption={createdAt:1};
        }
        else if(sort==="high"){
          sortOption={totalAmount:-1};
      }
      else if(sort==="low"){
        sortOption={totalAmount:1};
      }
    }
      const payments=await paymentsCollection.find(query).sort(sortOption || {}).toArray();
      res.json(payments);
        } );  

        app.get(`/recent-transactions`,async(req,res)=>
        {
          const {email}=req.query;
          const query={userEmail:email};
          const payments=await paymentsCollection.find(query).sort({createdAt:-1}).limit(5).toArray();
          res.json(payments);
        })
        app.get('/payment-history',async(req,res)=>
        {
          const {email,search,category,sort}=req.query;
          const query={userEmail:email, status:'Paid'};
          if(search)
          {
            query.name={$regex: search, $options: 'i'};
          }
          if(category)
          {
            query.category=category;
          }
          if(sort)
          {
            if(sort==="newest")
            {
              sortOption={paidAt:-1};
            }
            else if(sort==="oldest")
            {
              sortOption={paidAt:1};
            }
            else if(sort==="high")
            {
              sortOption={totalAmount:-1};

            }
            else if(sort==="low")
            {
              sortOption={totalAmount:1};
            }
          }
          const payments=await paymentsCollection.find(query).sort(sortOption || {}).toArray();
          res.json(payments);
        })

        app.get('/dashboard-stats',async(req,res)=>
        {
          const {email}=req.query;
          const query={userEmail:email};
         const allPayments=await paymentsCollection.find(query).toArray();
         const paidPayments=allPayments.filter(payment=>payment.status==='Paid');
         const pendingPayments=allPayments.filter(payment=>payment.status==='Pending');
         const totalPaidAmount=paidPayments.reduce((sum,payment)=>sum+payment.totalAmount,0);
         const totalPendingAmount=pendingPayments.reduce((sum,payment)=>sum+payment.totalAmount,0);
         const lastPayment=paidPayments.sort((a,b)=>new Date(b.paidAt)-new Date(a.paidAt))[0];
         res.json({totalPaidAmount,totalPendingAmount,totalPaidCount:paidPayments.length,totalPendingCount:pendingPayments.length,lastPayment});

        })
        app.get('/adminstats',async(req,res)=>
{
  const totalUsers=await usersCollection.countDocuments({role: 'user'});
  const totalTransactions=await paymentsCollection.countDocuments();
  const payment=await paymentsCollection.find({status:'Paid'},{projection:{totalAmount:1}}).toArray();
  const totalPaidAmount=payment.reduce((sum,payment)=>sum+payment.totalAmount,0);
  const totalPaidCount=await paymentsCollection.countDocuments({status:'Paid'});
  const pending=await paymentsCollection.find({status:'Pending'},{projection:{totalAmount:1}}).toArray();
  const totalPendingAmount=pending.reduce((sum,payment)=>sum+payment.totalAmount,0);
  const totalPendingCount=await paymentsCollection.countDocuments({status:'Pending'});

  res.json({totalUsers,totalTransactions,totalPaidAmount,totalPaidCount,totalPendingAmount,totalPendingCount});


})
        app.get('/pending-payments/stats',async(req,res)=>
        {
          const {email}=req.query;
          const query={userEmail:email, status:'Pending'};
          const totalPending =await paymentsCollection.countDocuments(query);
          const lastpending=await paymentsCollection.find(query).sort({createdAt:-1}).limit(1).toArray();
          const totalAmount =await paymentsCollection.find(query,{projection:{totalAmount:1}}).toArray();
          const totalAmountSum=totalAmount.reduce((sum,payment)=>sum+payment.totalAmount,0);
         res.json({totalPending,lastpending,totalAmountSum});
        })
        app.get('/payment-stats',async(req,res)=>
        {
          const {email}=req.query;
          const query={userEmail:email};
          const totalPaid=await paymentsCollection.countDocuments({...query, status:'Paid'});
          const totalPaidAmount=await paymentsCollection.find({...query, status:'Paid'},{projection:{totalAmount:1}}).toArray();
          const totalPaidAmountSum=totalPaidAmount.reduce((sum,payment)=>sum+payment.totalAmount,0);
          const lastPaid=await paymentsCollection.find({...query, status:'Paid'}).sort({paidAt:-1}).limit(1).toArray();
          return res.json({totalPaid,totalPaidAmountSum,lastPaid});
        })

        app.get('/payment',async(req,res)=>
        {
          const {id}=req.query;
         
          const query={id:id};
          const payment=await paymentsCollection.findOne(query);
          res.json(payment);

        })
        app.patch('/payment',async(req,res)=>
        {
          const {id}=req.query;
          const updatedInfo=req.body;
          const query={id:id};
          const updateDoc={
            $set:updatedInfo
          }
          const result=await paymentsCollection.updateOne(query,updateDoc);
          res.json(result);

        })
        app.delete('/payment',async(req,res)=>
        {
          
         console.log(req.query);
          const {id}=req.query;
          const query={id:id};
          const result=await paymentsCollection.deleteOne(query);
          console.log(`Deleted payment with ID: ${id}, Result: ${result.deletedCount} document(s) deleted`);
res.json(result);
        })


         //Tax-Vat Rates API
    app.get('/taxvatrates', async (req, res) => {
      const taxvatrates=await taxvatratesCollection.find().toArray();
      res.json(taxvatrates);

    });
    app.post('/taxvatrates', async (req, res) => {
      const taxvatrate = req.body;
      const result = await taxvatratesCollection.insertOne(taxvatrate);
      res.json(result);
    });


    //role related API
    app.get('/userRole',async(req,res)=>
    {
      const {email}=req.query;
      const query={email:email};
      const user=await usersCollection.findOne(query,{projection:{role:1}});
    
      res.json({role:user?.role || 'User'});

    })

    //Entities API
app.get('/entities', async (req, res) => {
  const {designation} = req.query;
  if(designation==='teacher')
  {
    const entites=await entitiesCollection.find({type:'Department'},{projection:{name:1}}).sort({name:1}).toArray();
    res.json(entites);
  }
  else 
  {
    const entites=await entitiesCollection.find({},{projection:{name:1}}).sort({name:1}).toArray();
    res.json(entites);

  }
})

    app.post('/entities', async (req, res) => {
      const entity = req.body;
      const result = await entitiesCollection.insertOne(entity);
      res.json(result);
    });


    
    await client.db("admin").command({ ping: 1 });
    dbConnected = true;
   

  } catch (err) {
    dbConnected = false;
    console.error("❌ MongoDB connection failed:", err.message);
  }
}

run();

app.get('/', (req, res) => {
  res.send('NSTU TaxDesk server is running');
})



app.get('/health', (req, res) => {
  res.status(dbConnected ? 200 : 503).json({
    ok: dbConnected,
    mongo: dbConnected ? 'connected' : 'disconnected'
  })
})



app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`)
})