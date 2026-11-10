#!/usr/bin/env node
/* ============================================
   NetGuard — manage admin accounts from the command line
   Useful when nobody can log in (e.g. a forgotten password).

   npm run admin -- list
   npm run admin -- add <username>
   npm run admin -- reset-password <username>
   npm run admin -- delete <username>

   Passwords are typed at a hidden prompt, so they don't end up
   in your terminal history. The server doesn't need restarting.
   ============================================ */

const readline = require("readline");
const accounts = require("./admin-accounts");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: Boolean(process.stdin.isTTY)
});
const lines = rl[Symbol.asyncIterator]();

// Hide what's typed while a password is being entered
let muted = false;
rl._writeToOutput = text => {
    if (!muted) rl.output.write(text);
    else if (/[\r\n]/.test(text)) rl.output.write("\n");
};

async function ask(question, { hidden = false } = {}) {
    process.stdout.write(question);
    muted = hidden;
    const { value, done } = await lines.next();
    muted = false;
    if (done) throw new Error("No input.");
    if (hidden && !process.stdin.isTTY) process.stdout.write("\n");
    return value;
}

// Asks twice and checks the rules. Passwords set here are temporary:
// the person must choose their own at their next login.
async function askNewPassword(username) {
    const password = await ask(`Temporary password for "${username}" (Enter = ${accounts.TEMPORARY_PASSWORD}): `, { hidden: true });
    if (password === "") return accounts.TEMPORARY_PASSWORD;
    const problem = accounts.checkNewPassword(password, username, { temporary: true });
    if (problem) throw new Error(problem);
    const again = await ask("Type it again: ", { hidden: true });
    if (again !== password) throw new Error("The passwords didn't match.");
    return password;
}

function findAccount(admins, name) {
    const checked = accounts.checkUsername(name || "");
    if (checked.error) throw new Error(checked.error);
    const admin = admins.find(a => a.username === checked.username);
    return { username: checked.username, admin };
}

const commands = {
    async list() {
        const admins = accounts.readAdmins();
        if (admins.length === 0) return console.log("No admin accounts yet. The server creates the team's accounts the first time it starts.");
        console.table(admins.map(a => ({
            username: a.username,
            created: a.createdAt,
            "last login": a.lastLoginAt || "never",
            "must change password": a.mustChangePassword ? "YES" : ""
        })));
    },

    async add(name) {
        const { username, admin } = findAccount(accounts.readAdmins(), name);
        if (admin) throw new Error(`"${username}" already exists. Use reset-password to change its password.`);
        const password = await askNewPassword(username);
        const record = await accounts.newAdminRecord(username, password, { mustChangePassword: true });
        const admins = accounts.readAdmins();
        if (admins.length >= accounts.MAX_ADMINS) throw new Error(`There can be at most ${accounts.MAX_ADMINS} accounts.`);
        admins.push(record);
        accounts.writeAdmins(admins);
        console.log(`Created admin account "${username}". They must choose their own password when they first log in.`);
    },

    async "reset-password"(name) {
        const { username, admin } = findAccount(accounts.readAdmins(), name);
        if (!admin) throw new Error(`There is no account called "${username}". Run "npm run admin -- list" to see them.`);
        const password = await askNewPassword(username);
        const hash = await accounts.hashPassword(password);
        const admins = accounts.readAdmins();
        const record = admins.find(a => a.id === admin.id);
        record.passwordHash = hash;
        record.passwordChangedAt = new Date().toISOString();
        record.mustChangePassword = true;
        accounts.writeAdmins(admins);
        console.log(`Password for "${username}" reset. They've been logged out and must choose a new password at their next login.`);
    },

    async delete(name) {
        const admins = accounts.readAdmins();
        const { username, admin } = findAccount(admins, name);
        if (!admin) throw new Error(`There is no account called "${username}".`);
        if (admins.length === 1) throw new Error("That's the only account. Add another one first, or you won't be able to log in.");
        const answer = await ask(`Delete "${username}"? Type the username to confirm: `);
        if (answer.trim().toLowerCase() !== username) return console.log("Cancelled.");
        accounts.writeAdmins(admins.filter(a => a.id !== admin.id));
        console.log(`Deleted "${username}".`);
    }
};

async function main() {
    const [command, name] = process.argv.slice(2);
    if (!commands[command]) {
        console.log("Usage:\n  npm run admin -- list\n  npm run admin -- add <username>\n  npm run admin -- reset-password <username>\n  npm run admin -- delete <username>");
        process.exitCode = command ? 1 : 0;
        return;
    }
    await commands[command](name);
}

main()
    .catch(err => {
        console.error("Error:", err.message);
        process.exitCode = 1;
    })
    .finally(() => rl.close());
