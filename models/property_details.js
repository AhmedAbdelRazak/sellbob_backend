/** @format */

const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema;

const propertyDetailsSchema = new mongoose.Schema(
	{
		propertyName: {
			type: String,
			trim: true,
			lowercase: true,
			required: true,
		},

		propertyName_OtherLanguage: {
			type: String,
			trim: true,
			lowercase: true,
			default: "",
		},

		propertyCountry: {
			type: String,
			trim: true,
			lowercase: true,
			default: "India",
		},

		propertyState: {
			type: String,
			trim: true,
			lowercase: true,
			default: "",
		},

		propertyCity: {
			type: String,
			trim: true,
			lowercase: true,
			default: "",
		},

		aboutProperty: {
			type: String,
			trim: true,
			lowercase: true,
			default: "",
		},

		aboutPropertyOtherLanguange: {
			type: String,
			trim: true,
			lowercase: true,
			default: "",
		},

		phone: {
			type: String,
			trim: true,
			lowercase: true,
			default: "",
		},

		propertyAddress: {
			type: String,
			trim: true,
			lowercase: true,
			default: "",
		},

		propertyFloors: {
			// How many floors in the property
			type: Number,
		},

		overallRoomsCount: {
			type: Number,
		},

		bathRoomsCount: {
			type: Number,
			default: 1,
		},

		propertySize: {
			type: Object,
			default: {
				size: 0,
				unit: "square meter",
			},
		},

		userViews: {
			type: Number,
			default: 0,
		},

		userViewsByDays: {
			type: Array,
			default: [],
		},

		userWishList: {
			user: [{ type: ObjectId, ref: "User" }],
		},

		amenities: {
			type: Array,
			default: [],
		},

		views: {
			type: Array,
			default: [],
		},

		roomCountDetails: {
			type: [
				{
					roomType: String, // E.g., "living room, bedroom, bathroom"
					count: Number,
					photos: Array,
					displayName: String,
					displayName_OtherLanguage: String,
					description: String,
					description_OtherLanguage: String,
					extraAmenities: Array,
					refundPolicyDays: Number,
					roomSize: {
						type: Number,
						default: 100,
					},
					sharedRoomInSharedProperty: {
						type: Boolean,
						default: false,
					},
				},
			],
		},

		propertyPhotos: {
			type: Array,
			default: [],
		},
		propertyRating: {
			type: Number,
			default: 3.5,
		},
		propertyPrice: {
			type: Number,
		},
		propertyExtraFees: {
			type: Number,
		},

		activePropertyByAgent: {
			type: Boolean,
			default: true,
		},

		subscribedToLeads: {
			type: Boolean,
			default: false,
		},

		subscribedToCampaign: {
			type: Boolean,
			default: false,
		},

		propertyStatus: {
			type: String,
			default: "sale", //sale, rent
		},

		sharedProperty: {
			type: Boolean,
			default: false,
		},

		propertyType: {
			type: String,
			default: "apartment",
			lowercase: true,
		},

		activeProperty: {
			type: Boolean,
			default: false,
		},

		featured: {
			type: Boolean,
			default: false,
		},

		currency: {
			type: String, //Blank
			trim: true,
			lowercase: true,
			default: "RUPEE",
		},

		location: {
			type: {
				type: String,
				enum: ["Point"], // 'location.type' must be 'Point'
				required: true,
				default: "Point",
			},
			coordinates: {
				type: [Number],
				required: true,
				default: [0, 0], // Default to coordinates [longitude, latitude]
			},
		},

		commission: {
			type: Number,
			trim: true,
			lowercase: true,
			default: 10,
		},

		closeAreas: {
			type: Array,
			trim: true,
			lowercase: true,
		},

		belongsTo: { type: ObjectId, ref: "User" },
	},
	{ timestamps: true }
);

module.exports = mongoose.model("PropertyDetails", propertyDetailsSchema);
