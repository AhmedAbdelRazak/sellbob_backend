/** @format */

const User = require("../models/user");
const mongoose = require("mongoose");

exports.userById = async (req, res, next, id) => {
	console.log(id, "id");
	try {
		const user = await User.findById(id).select(
			"_id name email phone role activeUser profilePhoto userRole"
		);

		if (!user) {
			return res.status(400).json({
				error: "User not found",
			});
		}

		req.profile = user;
		next();
	} catch (err) {
		console.error(err);
		return res.status(400).json({
			error: "Something went wrong fetching the user",
		});
	}
};

exports.updatedUserId = async (req, res, next, id) => {
	try {
		const userNeedsUpdate = await User.findById(id)
			.select(
				"_id name email phone role user points activePoints likesUser activeUser profilePhoto userRole history userStore userBranch"
			)
			.exec(); // Promise-based

		if (!userNeedsUpdate) {
			return res.status(400).json({
				error: "user not found yad",
			});
		}

		req.updatedUserByAdmin = userNeedsUpdate;
		next();
	} catch (err) {
		console.log("updatedUserId error:", err);
		return res.status(400).json({ error: "user not found yad" });
	}
};

exports.read = (req, res) => {
	req.profile.hashed_password = undefined;
	req.profile.salt = undefined;
	return res.json(req.profile);
};

exports.remove = (req, res) => {
	let user = req.user;
	user.remove((err, deletedUser) => {
		if (err) {
			return res.status(400).json({
				error: errorHandler(err),
			});
		}
		res.json({
			manage: "User was successfully deleted",
		});
	});
};

exports.allUsersList = (req, res) => {
	User.find()
		.select("_id name email phone role activeUser profilePhoto userRole")
		.exec((err, users) => {
			if (err) {
				return res.status(400).json({
					error: "users not found",
				});
			}
			res.json(users);
		});
};

exports.update = (req, res) => {
	// console.log('UPDATE USER - req.user', req.user, 'UPDATE DATA', req.body);
	const { name, password } = req.body;

	User.findOne({ _id: req.profile._id }, (err, user) => {
		if (err || !user) {
			return res.status(400).json({
				error: "User not found",
			});
		}
		if (!name) {
			return res.status(400).json({
				error: "Name is required",
			});
		} else {
			user.name = name;
		}

		if (password) {
			if (password.length < 6) {
				return res.status(400).json({
					error: "Password should be min 6 characters long",
				});
			} else {
				user.password = password;
			}
		}

		user.save((err, updatedUser) => {
			if (err) {
				console.log("USER UPDATE ERROR", err);
				return res.status(400).json({
					error: "User update failed",
				});
			}
			updatedUser.hashed_password = undefined;
			updatedUser.salt = undefined;
			res.json(updatedUser);
		});
	});
};

exports.updateUserByAdmin = async (req, res) => {
	try {
		// Destructure fields from the request body
		const { name, password, activeUser, profilePhoto, email, phone } = req.body;

		// This comes from the URL param, e.g. /user-account/:updatedUserId/:userId
		const { updatedUserId } = req.params;

		// Find the user to update
		const user = await User.findById(updatedUserId).exec();
		if (!user) {
			return res.status(400).json({ error: "User not found" });
		}

		// Validation checks (required fields)
		if (!name) {
			return res.status(400).json({ error: "Name is required" });
		} else {
			user.name = name;
		}

		if (password) {
			if (password.length < 6) {
				return res
					.status(400)
					.json({ error: "Password should be at least 6 characters long" });
			}
			user.password = password;
		}

		if (!email) {
			return res.status(400).json({ error: "Email is required" });
		} else {
			user.email = email;
		}

		if (typeof activeUser === "undefined") {
			return res.status(400).json({ error: "activeUser is required" });
		} else {
			user.activeUser = activeUser;
		}

		if (!profilePhoto) {
			// If your schema always expects an object: { public_id, url }, validate
			return res.status(400).json({ error: "profilePhoto is required" });
		} else {
			user.profilePhoto = profilePhoto;
		}

		// phone might be optional (if you want it required, validate similarly)
		if (phone) {
			user.phone = phone;
		}

		// Save updates
		const updatedUser = await user.save();

		// Remove sensitive fields
		updatedUser.hashed_password = undefined;
		updatedUser.salt = undefined;

		return res.json(updatedUser);
	} catch (err) {
		console.log("USER UPDATE ERROR", err);
		return res.status(400).json({
			error: "User update failed",
		});
	}
};

exports.getSingleUser = async (req, res) => {
	try {
		const { accountId } = req.params;

		// If you need to manually convert the string to ObjectId, do:
		// const belongsTo = new mongoose.Types.ObjectId(accountId);

		// Otherwise, just pass the string directly:
		const user = await User.findOne({ _id: accountId }).exec(); // `.exec()` returns a Promise if no callback is provided

		if (!user) {
			return res.status(400).json({ error: "User not found" });
		}

		// Remove sensitive info
		user.hashed_password = undefined;
		user.salt = undefined;

		return res.json(user);
	} catch (err) {
		console.error("getSingleUser error:", err);
		return res.status(500).json({
			error: "Something went wrong while fetching the user",
		});
	}
};
