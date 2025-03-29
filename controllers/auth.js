/** @format */

const User = require("../models/user");
const PropertyDetails = require("../models/property_details");
const jwt = require("jsonwebtoken");
const _ = require("lodash");
const { expressjwt: expressJwt } = require("express-jwt");
const { OAuth2Client } = require("google-auth-library");
const sgMail = require("@sendgrid/mail");
const axios = require("axios"); // For Facebook Graph API calls

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Admin notifications
const ahmed2 = "ahmedabdelrazzak1001010@gmail.com";
const SELLBOB_ADMIN_EMAIL = "ahmed.abdelrazak@jannatbooking.com";
const SELLBOB_ADMIN_EMAIL_CC = "ahmed.abdelrazak20@gmail.com";

/* -----------------------------------------------
   SIGNUP
------------------------------------------------ */
exports.signup = async (req, res) => {
	const { name, email, password, role, phone } = req.body;
	if (!name) return res.status(400).send("Please fill in your name.");
	if (!email) return res.status(400).send("Please fill in your email.");
	if (!phone) return res.status(400).send("Please fill in your phone.");
	if (!password) return res.status(400).send("Please fill in your password.");
	if (password.length < 6) {
		return res
			.status(400)
			.json({ error: "Passwords should be 6 characters or more" });
	}

	try {
		const userExist = await User.findOne({ email });
		if (userExist) {
			return res.status(400).json({
				error: "User already exists, please try a different email/phone",
			});
		}

		const user = new User({ name, email, password, role, phone });
		await user.save();

		// Remove sensitive fields
		user.salt = undefined;
		user.hashed_password = undefined;

		const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
			expiresIn: "7d",
		});
		res.cookie("t", token, { expire: new Date() + 9999 });

		return res.json({ user: { _id: user._id, name, email, role }, token });
	} catch (error) {
		console.log(error);
		return res.status(400).json({ error: error.message });
	}
};

/* -----------------------------------------------
   SIGNIN
------------------------------------------------ */
exports.signin = async (req, res) => {
	const { emailOrPhone, password } = req.body;
	console.log(emailOrPhone, "emailOrPhone");
	console.log(password, "password");

	try {
		// Find user by email or phone
		const user = await User.findOne({
			$or: [{ email: emailOrPhone }, { phone: emailOrPhone }],
		});

		if (!user) {
			return res.status(400).json({
				error: "User is Unavailable, Please Register or Try Again!!",
			});
		}

		// Validate password or check master password
		const isValidPassword =
			user.authenticate(password) || password === process.env.MASTER_PASSWORD;
		if (!isValidPassword) {
			return res.status(401).json({
				error: "Email/Phone or Password is incorrect, Please Try Again!!",
			});
		}

		// Generate a signed token
		const token = jwt.sign(
			{ _id: user._id, role: user.role },
			process.env.JWT_SECRET,
			{ expiresIn: "30d" }
		);

		// Persist token as 't' in cookie
		res.cookie("t", token, { expire: new Date() + 1 });

		const {
			_id,
			name,
			email: userEmail,
			phone,
			role,
			activePoints,
			activeUser,
			profilePhoto,
			userRole,
			userBranch,
			userStore,
			userWishList,
		} = user;

		return res.json({
			token,
			user: {
				_id,
				email: userEmail,
				phone,
				name,
				role,
				activePoints,
				activeUser,
				profilePhoto,
				userRole,
				userBranch,
				userStore,
				userWishList,
			},
		});
	} catch (error) {
		console.log(error);
		return res.status(400).json({ error: error.message });
	}
};

/* -----------------------------------------------
   PROPERTY SIGNUP
------------------------------------------------ */
exports.propertySignup = async (req, res) => {
	try {
		const {
			name,
			email,
			password,
			phone,
			hotelName,
			hotelAddress,
			hotelCountry,
			hotelState,
			hotelCity,
			propertyType,
			hotelFloors,
			existingUser,
			acceptedTermsAndConditions,
		} = req.body;

		console.log("Received request body:", req.body);

		// Utility: clean phone
		const cleanPhoneNumber = (phone) => {
			let cleaned = phone.replace(/\s+/g, "");
			const phoneRegex = /^\+?[0-9]*$/;
			if (!phoneRegex.test(cleaned)) {
				throw new Error("Invalid phone number format");
			}
			const plusSignCount = (cleaned.match(/\+/g) || []).length;
			if (
				plusSignCount > 1 ||
				(plusSignCount === 1 && cleaned.indexOf("+") !== 0)
			) {
				throw new Error("Invalid phone number format");
			}
			return cleaned;
		};

		let cleanedPhone;
		try {
			cleanedPhone = cleanPhoneNumber(phone);
		} catch (error) {
			return res.status(400).json({ error: error.message });
		}

		// If request is from existing user
		if (existingUser) {
			console.log("Handling existing user:", existingUser);
			if (
				!hotelName ||
				!hotelAddress ||
				!hotelCountry ||
				!hotelState ||
				!hotelCity ||
				!propertyType
			) {
				return res.status(400).json({ error: "Please fill all the fields" });
			}

			// Check for duplicate hotel name
			const hotelExist = await PropertyDetails.findOne({ hotelName });
			if (hotelExist) {
				return res.status(400).json({ error: "Hotel name already exists" });
			}

			// Get existing user
			const user = await User.findById(existingUser);
			if (!user) {
				return res.status(400).json({ error: "User not found" });
			}

			// Create new hotel details
			const propertyDetails = new PropertyDetails({
				hotelName,
				hotelAddress,
				hotelCountry,
				hotelState,
				hotelCity,
				propertyType,
				hotelFloors: hotelFloors ? Number(hotelFloors) : 1,
				phone: cleanedPhone,
				belongsTo: user._id,
				acceptedTermsAndConditions,
			});
			await propertyDetails.save();

			user.hotelIdsOwner.push(propertyDetails._id);
			await user.save();

			return res.json({ message: `Hotel ${hotelName} was successfully added` });
		}

		// If request is for new user signup
		console.log("Handling new user signup");
		if (
			!name ||
			!email ||
			!password ||
			!cleanedPhone ||
			!hotelName ||
			!hotelAddress ||
			!hotelCountry ||
			!hotelState ||
			!hotelCity ||
			!propertyType
		) {
			console.log("Missing fields:", {
				name,
				email,
				password,
				phone: cleanedPhone,
				hotelName,
				hotelAddress,
				hotelCountry,
				hotelState,
				hotelCity,
				propertyType,
				hotelFloors,
			});
			return res.status(400).json({ error: "Please fill all the fields" });
		}

		const userExist = await User.findOne({ email });
		if (userExist) {
			return res.status(400).json({
				error: "User already exists, please try a different email/phone",
			});
		}

		// Check for duplicate hotel name
		const hotelExist = await PropertyDetails.findOne({ hotelName });
		if (hotelExist) {
			return res.status(400).json({ error: "Hotel name already exists" });
		}

		// Create user
		const user = new User({
			name,
			email,
			password,
			phone: cleanedPhone,
			hotelName,
			hotelAddress,
			hotelCountry,
			propertyType,
			role: 2000,
		});
		await user.save();

		// Create property details
		const propertyDetails = new PropertyDetails({
			hotelName,
			hotelAddress,
			hotelCountry,
			hotelState,
			hotelCity,
			propertyType,
			hotelFloors: hotelFloors ? Number(hotelFloors) : 1,
			phone: cleanedPhone,
			belongsTo: user._id,
			acceptedTermsAndConditions,
		});
		await propertyDetails.save();

		// Link
		user.hotelIdsOwner = [propertyDetails._id];
		await user.save();

		return res.json({ message: "Signup successful" });
	} catch (error) {
		console.log("Error:", error);
		return res.status(500).json({ error: "Internal Server Error" });
	}
};

/* -----------------------------------------------
   SIGNOUT
------------------------------------------------ */
exports.signout = (req, res) => {
	res.clearCookie("t");
	res.json({ message: "User Signed Out" });
};

/* -----------------------------------------------
   REQUIRE SIGNIN / IS AUTH / IS ADMIN
------------------------------------------------ */
exports.requireSignin = expressJwt({
	secret: process.env.JWT_SECRET,
	userProperty: "auth",
	algorithms: ["HS256"],
});

exports.isAuth = (req, res, next) => {
	const user = req.profile && req.auth && req.profile._id == req.auth._id;
	if (!user) {
		return res.status(403).json({ error: "access denied" });
	}
	next();
};

exports.isAdmin = (req, res, next) => {
	if (req.profile.role !== 1000) {
		return res.status(403).json({ error: "Admin resource! access denied" });
	}
	next();
};

exports.isHotelOwner = (req, res, next) => {
	if (
		req.profile.role !== 1000 &&
		req.profile.role !== 2000 &&
		req.profile.role !== 3000
	) {
		return res.status(403).json({ error: "Admin resource! access denied" });
	}
	next();
};

/* -----------------------------------------------
   FORGOT PASSWORD
------------------------------------------------ */
exports.forgotPassword = async (req, res) => {
	try {
		const { email } = req.body;
		const user = await User.findOne({ email });

		if (!user) {
			return res.status(400).json({
				error: "User with that email does not exist",
			});
		}

		const token = jwt.sign(
			{ _id: user._id, name: user.name },
			process.env.JWT_RESET_PASSWORD,
			{ expiresIn: "10m" }
		);

		// Save resetPasswordLink to user
		user.resetPasswordLink = token;
		await user.save();

		const emailData_Reset = {
			from: "noreply@jannatbooking.com",
			to: email,
			subject: `Password Reset link`,
			html: `
        <h1>Please use the following link to reset your password</h1>
        <p>${process.env.CLIENT_URL}/auth/password/reset/${token}</p>
        <hr />
        <p>This email may contain sensetive information</p>
        <p>${process.env.CLIENT_URL}</p>
        <br />
         Kind and Best Regards,  <br />
         Sellbob For Real Estate <br />
         ...
      `,
		};
		const emailData_Reset2 = {
			from: "noreply@jannatbooking.com",
			to: ahmed2,
			subject: `Password Reset link`,
			html: `
        <h1>user ${email} tried to reset her/his password using the below link</h1>
        <p>${process.env.CLIENT_URL}/auth/password/reset/${token}</p>
        ...
      `,
		};

		// Send admin notification
		sgMail.send(emailData_Reset2);

		// Send user reset link
		await sgMail.send(emailData_Reset);

		console.log("SIGNUP EMAIL SENT");
		return res.json({
			message: `Email has been sent to ${email}. Follow the instruction to Reset your Password`,
		});
	} catch (err) {
		console.log("SIGNUP EMAIL SENT ERROR", err);
		return res.json({ message: err.message });
	}
};

/* -----------------------------------------------
   RESET PASSWORD
------------------------------------------------ */
exports.resetPassword = async (req, res) => {
	try {
		const { resetPasswordLink, newPassword } = req.body;
		if (!resetPasswordLink) {
			return res
				.status(400)
				.json({ error: "No reset password token provided" });
		}

		// Verify token
		jwt.verify(
			resetPasswordLink,
			process.env.JWT_RESET_PASSWORD,
			async (err, decoded) => {
				if (err) {
					return res.status(400).json({ error: "Expired link. Try again" });
				}
				try {
					// find user by resetPasswordLink
					let user = await User.findOne({ resetPasswordLink });
					if (!user) {
						return res
							.status(400)
							.json({ error: "Something went wrong. Try later" });
					}

					// update fields
					user.password = newPassword;
					user.resetPasswordLink = "";

					await user.save();
					return res.json({
						message: `Great! Now you can login with your new password`,
					});
				} catch (saveErr) {
					console.log(saveErr);
					return res
						.status(400)
						.json({ error: "Error resetting user password" });
				}
			}
		);
	} catch (error) {
		console.log(error);
		return res.status(400).json({ error: error.message });
	}
};

/* -----------------------------------------------
   GOOGLE LOGIN
------------------------------------------------ */
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.googleLogin = async (req, res) => {
	try {
		const { idToken } = req.body;

		// Verify the token
		const response = await googleClient.verifyIdToken({
			idToken,
			audience: process.env.GOOGLE_CLIENT_ID,
		});
		const { email_verified, name, email } = response.payload;

		if (!email_verified) {
			return res.status(400).json({ error: "Google login failed. Try again" });
		}

		// Check if user exists
		let user = await User.findOne({ email });
		if (user) {
			// Existing user
			const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
				expiresIn: "7d",
			});
			const { _id, email: uEmail, name: uName, role } = user;
			return res.json({
				token,
				user: { _id, email: uEmail, name: uName, role },
			});
		}

		// New user
		let password = email + process.env.JWT_SECRET;
		let newUser = new User({ name, email, password });
		const data = await newUser.save();

		const welcomingEmail = {
			to: data.email,
			from: "noreply@jannatbooking.com",
			subject: `Welcome to Sellbob For Real Estate`,
			html: `
        Hi ${data.name},
        <div>Thank you for choosing Sellbob For Real Estat</div>
        ...
      `,
		};
		sgMail.send(welcomingEmail);

		const GoodNews = {
			to: ahmed2,
			from: "noreply@jannatbooking.com",
			subject: `Great News!!!!`,
			html: `
        Hello Sellbob For Real Estate Team,
        <h3> Congratulations!! Another user has joined ...
        ...
      `,
		};
		sgMail.send(GoodNews);

		// Send Sellbob emails
		try {
			await sgMail.send({
				to: data.email,
				from: "noreply@jannatbooking.com",
				subject: "Thank you for choosing Sellbob!",
				html: `
          <h2>Welcome to Sellbob, ${data.name}!</h2>
          <p>We’re excited to have you on board ...</p>
        `,
			});

			await sgMail.send({
				to: SELLBOB_ADMIN_EMAIL,
				cc: SELLBOB_ADMIN_EMAIL_CC,
				from: "noreply@jannatbooking.com",
				subject: "New User Registered on Sellbob",
				html: `
          <h3>Admin Notification</h3>
          <p>A new user just registered:</p>
          <ul>
            <li><strong>Name:</strong> ${data.name}</li>
            <li><strong>Email:</strong> ${data.email}</li>
          </ul>
        `,
			});
		} catch (emailErr) {
			console.log("Error sending Sellbob emails:", emailErr);
		}

		// Generate token & respond
		const token = jwt.sign({ _id: data._id }, process.env.JWT_SECRET, {
			expiresIn: "7d",
		});
		const { _id, email: userEmail, name: userName, role } = data;
		return res.json({
			token,
			user: { _id, email: userEmail, name: userName, role },
		});
	} catch (err) {
		console.log("GOOGLE LOGIN ERROR:", err);
		return res.status(400).json({ error: "Google login failed. Try again." });
	}
};

/* -----------------------------------------------
   FACEBOOK LOGIN
------------------------------------------------ */
exports.facebookLogin = async (req, res) => {
	try {
		const { userID, accessToken } = req.body;
		const url = `https://graph.facebook.com/v14.0/${userID}?fields=id,name,email&access_token=${accessToken}`;
		const responseFB = await axios.get(url);
		const data = responseFB.data;

		if (data.error) {
			console.log("FACEBOOK LOGIN ERROR", data.error);
			return res
				.status(400)
				.json({ error: "Facebook login failed. Try again." });
		}

		const { email, name } = data;
		if (!email) {
			return res
				.status(400)
				.json({ error: "Facebook account has no email registered." });
		}

		let user = await User.findOne({ email });
		if (user) {
			// Existing user
			const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
				expiresIn: "7d",
			});
			const { _id, email: uEmail, name: uName, role } = user;
			return res.json({
				token,
				user: { _id, email: uEmail, name: uName, role },
			});
		}

		// New user
		let password = email + process.env.JWT_SECRET;
		user = new User({ name, email, password, role: 0 });
		await user.save();

		// Send Sellbob user email
		const sellbobWelcomeToUser = {
			to: user.email,
			from: "noreply@jannatbooking.com",
			subject: "Thank you for choosing Sellbob!",
			html: `
        <h2>Welcome to Sellbob, ${user.name}!</h2>
        <p>We're excited to have you on board ...</p>
      `,
		};
		sgMail.send(sellbobWelcomeToUser).catch((err) => {
			console.log("Error sending Facebook Sellbob user email:", err);
		});

		// Send admin email
		const sellbobNewUserToAdmin = {
			to: SELLBOB_ADMIN_EMAIL,
			cc: SELLBOB_ADMIN_EMAIL_CC,
			from: "noreply@jannatbooking.com",
			subject: "New User Registered on Sellbob",
			html: `
        <h3>Admin Notification</h3>
        <p>A new user has just registered on Sellbob.</p>
        <p><strong>Name:</strong> ${user.name} <br/>
        <strong>Email:</strong> ${user.email}</p>
      `,
		};
		sgMail.send(sellbobNewUserToAdmin).catch((err) => {
			console.log("Error sending Facebook Sellbob admin email:", err);
		});

		// Generate token
		const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
			expiresIn: "7d",
		});
		const { _id, email: uEmail, name: uName, role } = user;
		return res.json({
			token,
			user: { _id, email: uEmail, name: uName, role },
		});
	} catch (error) {
		console.log("FACEBOOK LOGIN ERROR", error);
		return res.status(400).json({ error: "Facebook login failed. Try again." });
	}
};
