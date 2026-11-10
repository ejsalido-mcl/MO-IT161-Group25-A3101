/* ============================================
   NetGuard — Admin accounts
   Shared by app.js (the server) and manage-admins.js (command line).

   Accounts live in admins.json, which is NOT committed to git:
   even hashed passwords shouldn't be public.

   Passwords are hashed with scrypt (built into Node), a slow,
   salted password hash, so a stolen admins.json can't be turned
   back into passwords easily.
   ============================================ */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(crypto.scrypt);

const ADMINS_FILE = path.join(__dirname, "admins.json");
const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const MAX_ADMINS = 20;
// scrypt cost settings (Node's recommended defaults)
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

// "scrypt$N$r$p$salt$hash" (salt and hash in base64)
async function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = await scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
    return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), hash.toString("base64")].join("$");
}

async function verifyPassword(password, stored) {
    const parts = String(stored || "").split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [, N, r, p, saltB64, hashB64] = parts;
    const expected = Buffer.from(hashB64, "base64");
    const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, {
        N: Number(N), r: Number(r), p: Number(p)
    });
    return crypto.timingSafeEqual(actual, expected);
}

// Unlike the other data files, a broken admins.json is never silently reset:
// that would re-create the default admin account.
function readAdmins() {
    let text;
    try {
        text = fs.readFileSync(ADMINS_FILE, "utf8");
    } catch (err) {
        if (err.code === "ENOENT") return [];
        throw err;
    }
    const data = JSON.parse(text); // throws if the file is damaged
    if (!Array.isArray(data)) throw new Error("admins.json must contain a list of accounts.");
    return data;
}

// Write to a temporary file, then rename it into place, so a crash
// mid-write can never leave a half-written admins.json
function writeAdmins(admins) {
    const temp = ADMINS_FILE + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(admins, null, 2), { mode: 0o600 });
    fs.renameSync(temp, ADMINS_FILE);
}

// -> { username } (lowercased) or { error }
function checkUsername(value) {
    if (typeof value !== "string") return { error: "Please enter a username." };
    const username = value.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(username)) {
        return { error: "Usernames are 3-32 characters: letters, numbers, dots, dashes or underscores." };
    }
    return { username };
}

// The shared starting password new accounts get (they must change it at first login)
const TEMPORARY_PASSWORD = "netguard-admin";

// -> error message, or null if the password is acceptable.
// temporary: true for a password someone else sets for you (new account or
// reset). It may be the shared starting password, since it must be changed
// at the next login anyway.
function checkNewPassword(password, username, { temporary = false } = {}) {
    if (typeof password !== "string" || password.length < PASSWORD_MIN) {
        return `Passwords must be at least ${PASSWORD_MIN} characters.`;
    }
    if (password.length > PASSWORD_MAX) return `Passwords can be at most ${PASSWORD_MAX} characters.`;
    if (username && password.toLowerCase().includes(username.toLowerCase())) {
        return "The password can't contain the username.";
    }
    if (!temporary && password.toLowerCase() === TEMPORARY_PASSWORD) {
        return "Please choose your own password, not the shared starting one.";
    }
    return null;
}

async function newAdminRecord(username, password, extra = {}) {
    const now = new Date().toISOString();
    return {
        id: crypto.randomUUID(),
        username,
        passwordHash: await hashPassword(password),
        createdAt: now,
        passwordChangedAt: now,
        lastLoginAt: null,
        ...extra
    };
}

// What the dashboard may see about an account (never the hash)
function publicAdmin(admin) {
    const { id, username, createdAt, lastLoginAt, mustChangePassword } = admin;
    return { id, username, createdAt, lastLoginAt, mustChangePassword: Boolean(mustChangePassword) };
}

module.exports = {
    ADMINS_FILE,
    TEMPORARY_PASSWORD,
    PASSWORD_MAX,
    MAX_ADMINS,
    hashPassword,
    verifyPassword,
    readAdmins,
    writeAdmins,
    checkUsername,
    checkNewPassword,
    newAdminRecord,
    publicAdmin
};
