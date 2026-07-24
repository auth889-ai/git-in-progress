const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { MongoClient } = require("mongodb");
const dotenv = require("dotenv");
var ObjectId = require("mongodb").ObjectId;

dotenv.config();
const uri = process.env.MONGODB_URI;

let client;

async function connectClient() {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
}

async function signup(req, res) {
  const { username, password, email } = req.body;
  try {
    if (!username || !password || !email) {
      return res
        .status(400)
        .json({ message: "Username, email and password are required!" });
    }

    await connectClient();
    const db = client.db("githubclone");
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({
      $or: [{ username }, { email }],
    });
    if (user) {
      return res.status(400).json({ message: "User already exists!" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
      username,
      password: hashedPassword,
      email,
      repositories: [],
      followedUsers: [],
      starRepos: [],
    };

    const result = await usersCollection.insertOne(newUser);

    const token = jwt.sign(
      { id: result.insertedId },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "7d" }
    );
    res.json({ token, userId: result.insertedId });
  } catch (err) {
    console.error("Error during signup : ", err.message);
    res.status(500).send("Server error");
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  try {
    await connectClient();
    const db = client.db("githubclone");
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials!" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials!" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, {
      expiresIn: "7d",
    });
    res.json({ token, userId: user._id });
  } catch (err) {
    console.error("Error during login : ", err.message);
    res.status(500).send("Server error!");
  }
}

async function getAllUsers(req, res) {
  try {
    await connectClient();
    const db = client.db("githubclone");
    const usersCollection = db.collection("users");

    const users = await usersCollection
      .find({}, { projection: { password: 0 } })
      .toArray();
    res.json(users);
  } catch (err) {
    console.error("Error during fetching : ", err.message);
    res.status(500).send("Server error!");
  }
}

async function getUserProfile(req, res) {
  const currentID = req.params.id;

  try {
    await connectClient();
    const db = client.db("githubclone");
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne(
      { _id: new ObjectId(currentID) },
      { projection: { password: 0 } }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    // How many users follow this one (stored as ObjectId or legacy string)
    const followersCount = await usersCollection.countDocuments({
      followedUsers: { $in: [new ObjectId(currentID), currentID] },
    });

    res.send({ ...user, followersCount });
  } catch (err) {
    console.error("Error during fetching : ", err.message);
    res.status(500).send("Server error!");
  }
}

// PATCH /follow/:targetId — follow or unfollow another user (toggle)
async function toggleFollow(req, res) {
  const { targetId } = req.params;
  const me = req.user.id;

  try {
    if (String(targetId) === String(me)) {
      return res.status(400).json({ message: "You cannot follow yourself!" });
    }
    await connectClient();
    const db = client.db("githubclone");
    const usersCollection = db.collection("users");

    const target = await usersCollection.findOne({ _id: new ObjectId(targetId) });
    if (!target) {
      return res.status(404).json({ message: "User not found!" });
    }

    const meDoc = await usersCollection.findOne({ _id: new ObjectId(me) });
    const following = (meDoc?.followedUsers || []).some(
      (id) => String(id) === String(targetId)
    );

    await usersCollection.updateOne(
      { _id: new ObjectId(me) },
      following
        ? { $pull: { followedUsers: { $in: [new ObjectId(targetId), targetId] } } }
        : { $addToSet: { followedUsers: new ObjectId(targetId) } }
    );

    res.json({ following: !following, username: target.username });
  } catch (err) {
    console.error("Error during follow toggle : ", err.message);
    res.status(500).send("Server error!");
  }
}

async function updateUserProfile(req, res) {
  const currentID = req.params.id;
  const { email, password, avatar } = req.body;

  try {
    await connectClient();
    const db = client.db("githubclone");
    const usersCollection = db.collection("users");

    let updateFields = {};
    if (email) updateFields.email = email;
    if (typeof avatar === "string") {
      if (avatar.length > 3 * 1024 * 1024) {
        return res.status(400).json({ message: "Avatar too large — max ~2 MB image." });
      }
      updateFields.avatar = avatar; // data-URL string ("" clears it)
    }
    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      updateFields.password = hashedPassword;
    }
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: "Nothing to update." });
    }

    const updatedUser = await usersCollection.findOneAndUpdate(
      {
        _id: new ObjectId(currentID),
      },
      { $set: updateFields },
      { returnDocument: "after", projection: { password: 0 } }
    );
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found!" });
    }

    res.send(updatedUser);
  } catch (err) {
    console.error("Error during updating : ", err.message);
    res.status(500).send("Server error!");
  }
}

async function deleteUserProfile(req, res) {
  const currentID = req.params.id;

  try {
    await connectClient();
    const db = client.db("githubclone");
    const usersCollection = db.collection("users");

    const result = await usersCollection.deleteOne({
      _id: new ObjectId(currentID),
    });

    if (result.deletedCount == 0) {
      return res.status(404).json({ message: "User not found!" });
    }

    res.json({ message: "User Profile Deleted!" });
  } catch (err) {
    console.error("Error during updating : ", err.message);
    res.status(500).send("Server error!");
  }
}

module.exports = {
  getAllUsers,
  signup,
  login,
  getUserProfile,
  toggleFollow,
  updateUserProfile,
  deleteUserProfile,
};
