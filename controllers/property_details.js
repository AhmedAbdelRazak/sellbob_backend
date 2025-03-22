const PropertyDetails = require("../models/property_details");
const User = require("../models/user");
const mongoose = require("mongoose");
const _ = require("lodash");
const axios = require("axios");

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

exports.read = (req, res) => {
	return res.json(req.propertyDetails);
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
		// Query params
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 20;
		const skip = (page - 1) * limit;

		const search = (req.query.search || "").trim();
		const active = req.query.active; // "true", "false", or undefined
		const featured = req.query.featured; // "true", "false", or undefined

		/* ----------------------------------------------------------------
		 *  1) top3: from all properties (unfiltered) for scoreboard
		 * ----------------------------------------------------------------*/
		const top3Docs = await PropertyDetails.find({})
			.sort({ userViews: -1 })
			.limit(3)
			.select("propertyName userViews");

		const top3 = top3Docs.map((p) => ({
			name: p.propertyName,
			views: p.userViews || 0,
		}));

		/* ----------------------------------------------------------------
		 *  2) Fetch all agents (role=2000)
		 * ----------------------------------------------------------------*/
		const allAgents = await User.find({ role: 2000 })
			.select("_id name email phone")
			.lean();

		/* ----------------------------------------------------------------
		 *  3) For each agent, fetch their properties & filter them
		 * ----------------------------------------------------------------*/
		let allRows = [];

		for (let agent of allAgents) {
			// 3A) Check if agent's name/email/phone matches search
			const agentMatchesSearch = search
				? new RegExp(search, "i").test(agent.name) ||
				  new RegExp(search, "i").test(agent.email) ||
				  new RegExp(search, "i").test(agent.phone)
				: false;

			// 3B) fetch agent's properties
			const props = await PropertyDetails.find({
				belongsTo: agent._id,
			})
				.select(
					"propertyName propertyCity propertyState propertyCountry userViews propertyStatus propertyPrice activeProperty featured belongsTo"
				)
				.lean();

			// 3C) Filter by (active), (featured), (search)
			const matchedProps = props.filter((p) => {
				// 1) If active=“true” or “false”
				if (active === "true" && p.activeProperty !== true) return false;
				if (active === "false" && p.activeProperty !== false) return false;

				// 2) If featured="true", keep only p.featured===true
				if (featured === "true" && p.featured !== true) return false;

				// 2B) If featured="false", exclude only p.featured===true
				// so p.featured === false or undefined => pass
				if (featured === "false" && p.featured === true) return false;

				// 3) If search is provided, match propertyName/city/state
				if (search) {
					const propertyMatches = [
						p.propertyName,
						p.propertyCity,
						p.propertyState,
					]
						.filter(Boolean)
						.some((field) => new RegExp(search, "i").test(field));

					// keep if agent matched OR property matched
					return agentMatchesSearch || propertyMatches;
				}

				// if no search => keep anything that passes the above filters
				return true;
			});

			// 3D) Build table rows
			if (matchedProps.length > 0) {
				// push one row per matching property
				for (let p of matchedProps) {
					const loc = [p.propertyCity, p.propertyState, p.propertyCountry]
						.filter(Boolean)
						.join(", ");

					allRows.push({
						key: `p-${p._id}`,
						property: p.propertyName || "Untitled",
						featured: p.featured,
						location: loc || "N/A",
						views: p.userViews || 0,
						appointments: 0, // or your logic
						status: p.propertyStatus || "N/A",
						price: p.propertyPrice
							? `${p.propertyPrice.toLocaleString()}`
							: "0",
						activeProperty: p.activeProperty === true,
						ownerName: agent.name,
						ownerEmail: agent.email,
						ownerPhone: agent.phone,
						ownerId: agent._id,
					});
				}
			} else {
				// No matched properties => possibly show “N/A” row
				// only if not filtering by active or featured,
				// and either no search or the agent matched
				const noActiveFilter = active === undefined || active === null;
				const noFeaturedFilter = featured === undefined || featured === null;

				if (noActiveFilter && noFeaturedFilter) {
					if (!search || agentMatchesSearch) {
						allRows.push({
							key: `u-${agent._id}`,
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
							ownerId: agent._id,
						});
					}
				}
			}
		}

		/* ----------------------------------------------------------------
		 *  4) In-memory pagination of allRows
		 * ----------------------------------------------------------------*/
		const totalCount = allRows.length;
		const startIndex = skip;
		const endIndex = startIndex + limit;
		const pageRows = allRows.slice(startIndex, endIndex);

		return res.json({
			top3,
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
