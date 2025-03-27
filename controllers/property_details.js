const PropertyDetails = require("../models/property_details");
const User = require("../models/user");
const mongoose = require("mongoose");
const _ = require("lodash");
const axios = require("axios");
const Appointment = require("../models/appointment");

exports.propertyTypeById = async (req, res, next, id) => {
	// 1) Validate ID
	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ error: "Invalid property ID" });
	}

	try {
		// 2) Await the query without a callback
		const propertyDetails = await PropertyDetails.findById(id);

		// 3) If not found, respond with an error
		if (!propertyDetails) {
			return res.status(400).json({ error: "Property details were not found" });
		}

		// 4) Attach the found doc to req and call next
		req.propertyDetails = propertyDetails;
		next();
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: "Something went wrong" });
	}
};

exports.create = async (req, res) => {
	try {
		const propertyDetails = new PropertyDetails(req.body);
		const data = await propertyDetails.save();
		res.json({ data });
	} catch (err) {
		console.error(err);
		res.status(400).json({
			error: "Cannot create property details",
		});
	}
};

exports.read = async (req, res) => {
	try {
		// Instead of returning `req.propertyDetails` directly,
		// we do a fresh find to properly populate belongsTo
		const propertyDetails = await PropertyDetails.findById(
			req.propertyDetails._id
		).populate("belongsTo", "name email phone profilePhoto");
		// The second parameter is the projection of fields you want

		if (!propertyDetails) {
			return res.status(400).json({ error: "Property details not found" });
		}

		return res.json(propertyDetails);
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: "Something went wrong" });
	}
};

// A helper to deeply merge fields from `source` into `target`.
function mergeDeep(target, source) {
	if (!target || !source) return;

	for (const key of Object.keys(source)) {
		const sourceVal = source[key];

		// If sourceVal is array => overwrite entirely
		if (Array.isArray(sourceVal)) {
			target[key] = sourceVal;
		}
		// If sourceVal is object => recursively merge
		else if (
			sourceVal &&
			typeof sourceVal === "object" &&
			!Array.isArray(sourceVal)
		) {
			if (
				!target[key] ||
				typeof target[key] !== "object" ||
				Array.isArray(target[key])
			) {
				target[key] = {};
			}
			mergeDeep(target[key], sourceVal);
		}
		// Otherwise => overwrite primitive
		else {
			target[key] = sourceVal;
		}
	}
}

// If you have color logic for rooms, define or remove as needed
function ensureUniqueRoomColors(roomCountDetails) {
	// For example, if you manage a colorMap by roomType:
	// ...
}

exports.updatePropertyDetails = async (req, res) => {
	try {
		const propertyDetailsId = req.params.propertyId;
		const updateData = req.body;

		console.log("updateData:", updateData);

		// 1) If "fromPage === 'AddNew'", we do the “AddNew” merging logic
		if (updateData.fromPage === "AddNew") {
			const propertyDetails = await PropertyDetails.findById(propertyDetailsId);
			if (!propertyDetails) {
				return res.status(404).json({ error: "Property details not found" });
			}

			// Merge roomCountDetails by (roomType + displayName)
			if (Array.isArray(updateData.roomCountDetails)) {
				const updatedRoomCount = propertyDetails.roomCountDetails.map(
					(existingRoom) => {
						const matchingNew = updateData.roomCountDetails.find(
							(nr) =>
								nr.roomType === existingRoom.roomType &&
								nr.displayName === existingRoom.displayName
						);
						if (matchingNew && Object.keys(matchingNew).length > 0) {
							// Partial/Deep merge fields
							mergeDeep(existingRoom, matchingNew);
							return existingRoom;
						}
						return existingRoom;
					}
				);

				// Add brand-new rooms that don't match existing
				updateData.roomCountDetails.forEach((newRoom) => {
					if (
						newRoom.roomType &&
						newRoom.displayName &&
						Object.keys(newRoom).length > 0
					) {
						const alreadyExists = updatedRoomCount.find(
							(r) =>
								r.roomType === newRoom.roomType &&
								r.displayName === newRoom.displayName
						);
						if (!alreadyExists) {
							// Possibly set newRoom.activeRoom = true, etc.
							updatedRoomCount.push(newRoom);
						}
					}
				});

				ensureUniqueRoomColors(updatedRoomCount);
				propertyDetails.roomCountDetails = updatedRoomCount;
				propertyDetails.markModified("roomCountDetails");
			}

			// Update top-level fields
			Object.keys(updateData).forEach((key) => {
				if (key !== "roomCountDetails") {
					propertyDetails[key] = updateData[key];
				}
			});

			const updatedDoc = await propertyDetails.save();
			return res.json(updatedDoc);
		}

		// 2) Otherwise, normal update logic with nested `_id` approach
		console.log("req.body (normal update):", updateData);

		const propertyDetails = await PropertyDetails.findById(propertyDetailsId);
		if (!propertyDetails) {
			return res.status(404).json({ error: "Property details not found" });
		}

		if (Array.isArray(updateData.roomCountDetails)) {
			// Convert each newRoom's `_id` if it's invalid to `undefined` so Mongoose generates one.
			// If it's a local_... we remove `_id`.
			updateData.roomCountDetails.forEach((newRoom) => {
				if (
					!newRoom._id ||
					!mongoose.isValidObjectId(newRoom._id) ||
					String(newRoom._id).startsWith("local_")
				) {
					// remove the _id so Mongoose can treat it as a new subdoc
					delete newRoom._id;
				}
			});

			// existing logic:
			const updatedRoomCount = propertyDetails.roomCountDetails.map(
				(existingRoom) => {
					if (!existingRoom._id) return existingRoom;

					const matchNew = updateData.roomCountDetails.find(
						(nr) => nr._id && nr._id.toString() === existingRoom._id.toString()
					);
					if (matchNew && Object.keys(matchNew).length > 0) {
						// deep merge
						mergeDeep(existingRoom, matchNew);
						return existingRoom;
					}
					return existingRoom;
				}
			);

			// Add brand-new rooms (those that no longer have `_id` or had invalid `_id`)
			updateData.roomCountDetails.forEach((newRoom) => {
				// If newRoom now has no _id => it's brand new
				if (!newRoom._id) {
					updatedRoomCount.push(newRoom);
				} else {
					// Or if newRoom._id didn't match an existing subdoc in the array
					const found = updatedRoomCount.some(
						(r) => r._id && r._id.toString() === newRoom._id.toString()
					);
					if (!found) {
						updatedRoomCount.push(newRoom);
					}
				}
			});

			ensureUniqueRoomColors(updatedRoomCount);
			propertyDetails.roomCountDetails = updatedRoomCount;
			propertyDetails.markModified("roomCountDetails");
		}

		// Update top-level fields
		Object.keys(updateData).forEach((key) => {
			if (key !== "roomCountDetails") {
				propertyDetails[key] = updateData[key];
			}
		});

		const updatedDoc = await propertyDetails.save();
		console.log("Property details updated successfully:", updatedDoc);
		return res.json(updatedDoc);
	} catch (err) {
		console.error("Error in updatePropertyDetails:", err);
		return res.status(500).json({ error: "Internal server error" });
	}
};

exports.list = (req, res) => {
	const userId = mongoose.Types.ObjectId(req.params.accountId);

	PropertyType.find({ belongsTo: userId })
		.populate("belongsTo", "name email") // Select only necessary fields
		.exec((err, data) => {
			if (err) {
				console.log(err, "err");
				return res.status(400).json({ error: err });
			}
			res.json(data);
		});
};

exports.remove = (req, res) => {
	const propertyDetails = req.propertyDetails;

	propertyDetails.remove((err) => {
		if (err) {
			return res.status(400).json({ error: "Error while removing" });
		}
		res.json({ message: "Property details deleted" });
	});
};

exports.getPropertyDetails = (req, res) => {
	return res.json(req.propertyDetails);
};

// controllers/property_details.js

exports.listForAdmin = async (req, res) => {
	try {
		// 1) Parse query params
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 20;
		const skip = (page - 1) * limit;

		const search = (req.query.search || "").trim();
		const active = req.query.active; // "true", "false", or undefined
		const featured = req.query.featured; // "true", "false", or undefined

		// 2) top3: from all properties (unfiltered) for scoreboard
		const top3Docs = await PropertyDetails.find({})
			.sort({ userViews: -1 })
			.limit(3)
			.select("propertyName userViews")
			.lean();

		const top3 = top3Docs.map((p) => ({
			name: p.propertyName,
			views: p.userViews || 0,
		}));

		// 3) "overallWishlists": total wishlisted across *all* properties
		const wishlistAgg = await PropertyDetails.aggregate([
			{
				$project: {
					// wlCount is the size of userWishList.user array
					wlCount: { $size: "$userWishList.user" },
				},
			},
			{
				$group: {
					_id: null,
					totalWishlists: { $sum: "$wlCount" },
				},
			},
		]);
		const overallWishlists = wishlistAgg?.[0]?.totalWishlists || 0;

		// 4) Fetch all agents (role=2000)
		const allAgents = await User.find({ role: 2000 })
			.select("_id name email phone")
			.lean();

		let allRows = [];
		// We'll keep track of *all property IDs* we end up including, for upcoming appointments
		const propertyIdSet = new Set();

		// 5) For each agent, fetch their properties & filter them
		for (let agent of allAgents) {
			// 5A) Check if agent matches search
			const agentMatchesSearch = search
				? new RegExp(search, "i").test(agent.name) ||
				  new RegExp(search, "i").test(agent.email) ||
				  new RegExp(search, "i").test(agent.phone)
				: false;

			// 5B) fetch agent's properties (including userViewsByDays for the 30-day aggregation)
			const props = await PropertyDetails.find({
				belongsTo: agent._id,
			})
				.select(
					"propertyName propertyCity propertyState propertyCountry userViews propertyStatus propertyPrice activeProperty featured belongsTo userViewsByDays"
				) // add userViewsByDays here
				.lean();

			// 5C) Filter by (active, featured, search)
			const matchedProps = props.filter((p) => {
				// 1) If active=“true” or “false”
				if (active === "true" && p.activeProperty !== true) return false;
				if (active === "false" && p.activeProperty !== false) return false;

				// 2) If featured="true", keep only p.featured===true
				if (featured === "true" && p.featured !== true) return false;

				// 3) If featured="false", exclude p.featured===true
				if (featured === "false" && p.featured === true) return false;

				// 4) If search is provided, match propertyName/city/state or agent
				if (search) {
					const propertyMatches = [
						p.propertyName,
						p.propertyCity,
						p.propertyState,
					]
						.filter(Boolean)
						.some((field) => new RegExp(search, "i").test(field));

					// Keep if agent matched or property matched
					return agentMatchesSearch || propertyMatches;
				}

				// If no search => keep
				return true;
			});

			// 5D) Build table rows
			if (matchedProps.length > 0) {
				for (let p of matchedProps) {
					const loc = [p.propertyCity, p.propertyState, p.propertyCountry]
						.filter(Boolean)
						.join(", ");

					// 5D.1) Collect propertyId for upcoming appointments aggregator
					propertyIdSet.add(String(p._id));

					// 5D.2) Build "viewsPerDay" array for last 30 days
					const now = new Date();
					const startDate = new Date(now);
					startDate.setDate(now.getDate() - 30); // 30 days ago
					startDate.setHours(0, 0, 0, 0);

					const dailyCountMap = {}; // { 'MM/DD/YYYY': number }

					// If userViewsByDays is large, we could do advanced logic,
					// but here we do it in-memory:
					(p.userViewsByDays || []).forEach((entry) => {
						const entryDate = new Date(entry.Date);
						if (entryDate >= startDate) {
							// Convert to mm/dd/yyyy
							const mm = String(entryDate.getMonth() + 1).padStart(2, "0");
							const dd = String(entryDate.getDate()).padStart(2, "0");
							const yyyy = entryDate.getFullYear();
							const dateStr = `${mm}/${dd}/${yyyy}`;

							dailyCountMap[dateStr] = (dailyCountMap[dateStr] || 0) + 1;
						}
					});

					// Transform map => array
					const viewsPerDay = Object.entries(dailyCountMap).map(
						([date, count]) => ({
							date,
							count,
						})
					);

					// Optionally, sort by ascending date
					viewsPerDay.sort((a, b) => {
						// parse date 'MM/DD/YYYY' into a real date
						const [am, ad, ay] = a.date.split("/");
						const [bm, bd, by] = b.date.split("/");
						const dateA = new Date(+ay, +am - 1, +ad);
						const dateB = new Date(+by, +bm - 1, +bd);
						return dateA - dateB;
					});

					allRows.push({
						key: `p-${p._id}`,
						propertyId: p._id.toString(),
						property: p.propertyName || "Untitled",
						featured: p.featured,
						location: loc || "N/A",
						views: p.userViews || 0,
						// We'll fill appointments later
						appointments: 0,
						status: p.propertyStatus || "N/A",
						price: p.propertyPrice
							? `${p.propertyPrice.toLocaleString()}`
							: "0",
						activeProperty: p.activeProperty === true,
						ownerName: agent.name,
						ownerEmail: agent.email,
						ownerPhone: agent.phone,
						ownerId: agent._id.toString(),
						// The new aggregated array
						viewsPerDay,
					});
				}
			} else {
				// No matched props => possibly show "N/A" row if no filters
				const noActiveFilter = active === undefined || active === null;
				const noFeaturedFilter = featured === undefined || featured === null;

				if (noActiveFilter && noFeaturedFilter) {
					if (!search || agentMatchesSearch) {
						allRows.push({
							key: `u-${agent._id}`,
							propertyId: null,
							property: "N/A",
							location: "N/A",
							featured: "No Property",
							views: 0,
							appointments: 0,
							status: "N/A",
							price: "0",
							activeProperty: false,
							ownerName: agent.name,
							ownerEmail: agent.email,
							ownerPhone: agent.phone,
							ownerId: agent._id.toString(),
							viewsPerDay: [], // no data
						});
					}
				}
			}
		}

		// 6) Now that we have all propertyIds, let's find upcoming appointment counts
		const propertyIds = Array.from(propertyIdSet).map(
			(id) => new mongoose.Types.ObjectId(id)
		);
		// "now" for upcoming
		const now = new Date();

		const upcomingAppointments = await Appointment.aggregate([
			{
				$match: {
					propertyId: { $in: propertyIds },
					appointmentDate: { $gte: now }, // future or today
				},
			},
			{
				$group: {
					_id: "$propertyId",
					count: { $sum: 1 },
				},
			},
		]);

		// Build a map: propertyId => count
		const upcomingMap = {};
		for (let doc of upcomingAppointments) {
			upcomingMap[doc._id.toString()] = doc.count;
		}

		// 7) Attach the "appointments" count to each row
		allRows.forEach((row) => {
			if (row.propertyId) {
				row.appointments = upcomingMap[row.propertyId] || 0;
			}
		});

		// 8) In-memory pagination
		const totalCount = allRows.length;
		const startIndex = skip;
		const endIndex = startIndex + limit;
		const pageRows = allRows.slice(startIndex, endIndex);

		return res.json({
			top3,
			overallWishlists, // new KPI
			tableData: pageRows,
			pagination: {
				page,
				limit,
				total: totalCount,
				pages: Math.ceil(totalCount / limit),
			},
		});
	} catch (err) {
		console.error("listForAdmin error:", err);
		return res.status(400).json({ error: err.message });
	}
};

exports.listOfPropertyUser = async (req, res) => {
	try {
		const { accountId } = req.params;

		// Find all property details where the belongsTo field matches the accountId
		const properties = await PropertyDetails.find({ belongsTo: accountId });

		if (!properties.length) {
			return res.status(404).json({
				message: "No properties found for this user.",
			});
		}

		res.status(200).json(properties);
	} catch (error) {
		console.error("Error fetching properties:", error);
		res.status(500).json({
			error: "An error occurred while fetching the properties.",
		});
	}
};

exports.listOfAgentProperties = async (req, res) => {
	try {
		const { userId } = req.params;

		// Find all property details where the belongsTo field matches the accountId
		const properties = await PropertyDetails.find({ belongsTo: userId });

		if (!properties.length) {
			return res.status(404).json({
				message: "No properties found for this user.",
			});
		}

		res.status(200).json(properties);
	} catch (error) {
		console.error("Error fetching properties:", error);
		res.status(500).json({
			error: "An error occurred while fetching the properties.",
		});
	}
};

exports.updatePropertyStatus = async (req, res) => {
	try {
		const { propertyId } = req.params;
		// We expect the request body to have, for instance, { newStatus: true or false }
		const { newStatus } = req.body;

		// Find & update the property.
		// newStatus is a boolean indicating what activeProperty should become.
		const updated = await PropertyDetails.findByIdAndUpdate(
			propertyId,
			{ activeProperty: !!newStatus }, // ensure boolean
			{ new: true }
		);

		if (!updated) {
			return res.status(404).json({ error: "Property not found" });
		}

		return res.json({
			message: "Property status updated successfully",
			property: updated,
		});
	} catch (err) {
		console.error("Error in updatePropertyStatus:", err);
		return res.status(400).json({ error: err.message });
	}
};

exports.updatePropertyFeatured = async (req, res) => {
	try {
		const { propertyId } = req.params;
		// e.g. { newFeatured: true or false } from the request body
		const { newFeatured } = req.body;

		// Optionally, ensure newFeatured is provided
		if (typeof newFeatured === "undefined") {
			return res.status(400).json({ error: "newFeatured is required" });
		}

		// Use $set so that the field is created if it doesn't exist
		const updated = await PropertyDetails.findByIdAndUpdate(
			propertyId,
			{ $set: { featured: !!newFeatured } }, // ensure boolean
			{ new: true, runValidators: true }
		);

		if (!updated) {
			return res.status(404).json({ error: "Property not found" });
		}

		return res.json({
			message: "Property featured status updated successfully",
			property: updated,
		});
	} catch (err) {
		console.error("Error in updatePropertyFeatured:", err);
		return res.status(400).json({ error: err.message });
	}
};

exports.listOfActivePropertiesForUser = async (req, res) => {
	try {
		// Find properties where both flags are true
		const properties = await PropertyDetails.find({
			activePropertyByAgent: true,
			activeProperty: true,
		});

		// If no properties are found, return a 404
		if (!properties.length) {
			return res.status(404).json({
				message: "No active properties found.",
			});
		}

		// Return the list of active properties
		return res.status(200).json(properties);
	} catch (error) {
		console.error("Error fetching active properties:", error);
		return res.status(500).json({
			error: "An error occurred while fetching active properties.",
		});
	}
};

exports.listOfActiveFeaturedProperties = async (req, res) => {
	try {
		// Find properties where both flags are true
		const properties = await PropertyDetails.find({
			activePropertyByAgent: true,
			activeProperty: true,
			featured: true,
		});

		// If no properties are found, return a 404
		if (!properties.length) {
			return res.status(404).json({
				message: "No active properties found.",
			});
		}

		// Return the list of active properties
		return res.status(200).json(properties);
	} catch (error) {
		console.error("Error fetching active properties:", error);
		return res.status(500).json({
			error: "An error occurred while fetching active properties.",
		});
	}
};

exports.toggleWishlist = async (req, res) => {
	try {
		const userId = req.auth._id; // from requireSignin
		const { propertyId } = req.params;

		// 1) Find user
		const user = await User.findById(userId);
		if (!user) {
			return res
				.status(404)
				.json({ success: false, message: "User not found." });
		}

		// 2) Find property
		const property = await PropertyDetails.findById(propertyId);
		if (!property) {
			return res
				.status(404)
				.json({ success: false, message: "Property not found." });
		}

		// user.userWishList.propertyDetails => array of ObjectIds
		// property.userWishList.user => array of ObjectIds

		let inWishlist = false;

		// 3) Check if user already has this property in wishlist
		const userHasProperty = user.userWishList.propertyDetails.some((pId) =>
			pId.equals(propertyId)
		);

		if (userHasProperty) {
			// => User is removing property from wishlist

			// Remove propertyId from user's array
			user.userWishList.propertyDetails =
				user.userWishList.propertyDetails.filter(
					(pId) => !pId.equals(propertyId)
				);

			// Remove userId from property's array
			property.userWishList.user = property.userWishList.user.filter(
				(uId) => !uId.equals(userId)
			);

			inWishlist = false;
		} else {
			// => User is adding property to wishlist

			// Add propertyId to user's array (push if not present)
			user.userWishList.propertyDetails.push(propertyId);

			// Add userId to property's array
			property.userWishList.user.push(userId);

			inWishlist = true;
		}

		// 4) Save the updated user & property
		await user.save();
		await property.save();

		return res.json({
			success: true,
			message: inWishlist
				? "Property added to your wishlist."
				: "Property removed from your wishlist.",
			inWishlist,
		});
	} catch (err) {
		console.error("Toggle wishlist error:", err);
		return res.status(500).json({
			success: false,
			message: "Server error toggling wishlist.",
		});
	}
};

// controllers/property_details.js

exports.addPropertyView = async (req, res) => {
	try {
		const { propertyDetailsId } = req.params;

		// 1) Check if the property exists
		const existing = await PropertyDetails.findById(propertyDetailsId).lean();
		if (!existing) {
			return res.status(404).json({ error: "Property not found" });
		}

		// 2) Extract user info from req.body
		//    If fields aren't present, default to "Guest"
		let userName = req.body.userName || "Guest";
		let email = req.body.email || "guest@example.com";
		let userId = req.body.userId || null;

		// 3) Floor the Date to the hour
		const now = new Date();
		now.setMinutes(0, 0, 0);

		// Build the view record
		const viewEntry = {
			userName,
			Email: email,
			_id: userId, // store userId if passed
			Date: now,
		};

		// 4) Atomic update: increment userViews, push a new entry, keep only last 2000
		const updated = await PropertyDetails.findByIdAndUpdate(
			propertyDetailsId,
			{
				$inc: { userViews: 1 },
				$push: {
					userViewsByDays: {
						$each: [viewEntry],
						$slice: -2000, // keep only the newest 2000 records
					},
				},
			},
			{ new: true } // return updated doc
		).lean();

		if (!updated) {
			return res
				.status(404)
				.json({ error: "Property not found (after update)." });
		}

		return res.json({
			success: true,
			message: "View recorded successfully",
			userViews: updated.userViews,
			lastViewEntry: viewEntry,
			totalViewEntries: updated.userViewsByDays.length,
		});
	} catch (err) {
		console.error("Error incrementing property views:", err);
		return res.status(500).json({ error: "Internal server error" });
	}
};
