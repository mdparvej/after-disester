const serverless = require('serverless-http');
const app = require('../index');
const port = process.env.PORT || 5000;
app.get('/users', async(req,res) => {
      
      res.send("this is from users  api");
    });
app.listen(port, () => {
  console.log(`this is new server port ${port}`)
});
module.exports.app = app;
module.exports.handler = serverless(app);