const express = require("express");
const morgan = require("morgan");
const path = require('path');
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoSanitize = require("express-mongo-sanitize");
const helmet = require("helmet");
const xss = require("xss-clean");
const compression = require("compression");
require("dotenv").config();
require("./config/dbConnection")();
const { connectRedis } = require("./config/redisConnection");

const port = process.env.PORT || 5002;
const app = express();

connectRedis();  // Connect to Redis

//Middlewares
// app.use(morgan("dev"));
app.use(morgan('[:date[clf]] :remote-addr  HTTP/:http-version  :method  :url  (:response-time ms)  :res[content-length]  :status'));

// Restrict website from being embedded in an iframe saving from Clickjacking.
// To set various Security headers to protect Cross-Site Scripting (XSS) attacks.
app.use(helmet());
/*
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"], // Allow resources from the same origin
                scriptSrc: ["'self'", "https://trusted-scripts.com"], // Allow scripts from trusted sources
            },
        },
        frameguard: { action: 'deny' }, // Prevent framing of the site
        xssFilter: true, // Enable XSS filter in browsers
    })
);
*/

// Import webhook routes before express.json as stripe webhooks want raw body
const webhookRoute = require("./constants/routes").STRIPE;
const webhookRouter = require("./routes/webhookRoutes");
app.use(webhookRoute, webhookRouter);

// This will give a parser which helps in getting data from client and get parsed, as without it, the req body will be undefined
// We need to parse the data from request body and for that we need to use a middleware, which express provides us for json
app.use(express.json());
app.use(bodyParser.urlencoded({ limit: '200mb', extended: true }));

// Removes or encodes potentially harmful scripts from input data (e.g., from request bodies, query parameters, or URL parameters) before they can be stored or rendered.
app.use(xss());

// To prevent NoSQL injection, To remove data using $ or . from req.body, req.query, and req.params
app.use(mongoSanitize());
// Optional: To replace prohibited characters with _
// app.use(mongoSanitize({ replaceWith: '_' }));

// Compress HTTP responses sent from your server to clients.
app.use(compression());


app.use(cors({
    origin: [
        'http://192.168.100.13:5002',
        'http://192.168.100.18:5002',
        'http://192.168.100.23:5002',
        'http://192.168.100.26:5002',
        'http://192.168.100.40:8081',
        'http://localhost:5002',
        'https://e-commerce-beta-cyan-72.vercel.app',
        'https://ecommerce-backend-five-eta.vercel.app',
        'https://checkout.stripe.com'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed methods
    credentials: true, // Allow cookies and credentials
}));


// Define routes
const authRoute = require("./constants/routes").AUTH;
const authRouter = require("./routes/authRoutes");

const userRoute = require("./constants/routes").USER;
const userRouter = require("./routes/userRoutes");

const categoryRoute = require("./constants/routes").CATEGORY;
const categoryRouter = require("./routes/categoryRoutes");

const productRoute = require("./constants/routes").PRODUCT;
const productRouter = require("./routes/productRoutes");

const uploadRoute = require("./constants/routes").UPLOAD;
const uploadRouter = require("./routes/uploadRoutes");

const orderRoute = require("./constants/routes").ORDERS;
const orderRouter = require("./routes/orderRoutes");

const dashboardRoute = require("./constants/routes").DASHBOARD;
const dashboardRouter = require("./routes/dashboardRoutes");

const storeSessionRoute = require("./constants/routes").USER_SESSION;
const storeSessionRoutes = require('./routes/storeSessionRoutes'); // lower case


// Use routes
app.use(authRoute, authRouter);
app.use(userRoute, userRouter);
app.use(categoryRoute, categoryRouter);
app.use(productRoute, productRouter);
app.use(uploadRoute, uploadRouter);
app.use(orderRoute, orderRouter);
app.use(dashboardRoute, dashboardRouter);
app.use(storeSessionRoute, storeSessionRoutes);


app.set('view engine', 'ejs')
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self' https://checkout.stripe.com");
    res.setHeader('X-Frame-Options', 'ALLOW-FROM https://checkout.stripe.com');
    next();
});

// app.get('/', (req, res) => {
//     res.render('index.ejs')
// })

// For Invalid Routes
app.use("*", (req, res) => {
    return res.status(404).sendFile(path.join(__dirname, 'public', 'notFound.html'));
});

// app.use(errorHandler);  

app.listen(port, () => {
    console.log("===================**===================");
    console.log(`Listening on http://localhost:${port}`);
});
