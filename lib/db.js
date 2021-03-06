// DB wrapper
'use strict';

const db = require('sqlite');
module.exports = db;

db.ready = (async function() {
	if (process.env.NODE_ENV === 'test') {
		await db.open(':memory:', {cache: true});
	} else {
		await db.open('db/feedback.sqlite', {cache: true});
	}
	// await db.migrate({force: 'last'});
	await db.migrate();
	return db;
})();

// Drop all rows from all tables and re-insert admin user.
db.reset = async function() {
	await db.ready;
	if (process.env.NODE_ENV !== 'test')
		return console.warn('WARNING: attempted to reset non-test DB!');

	//TODO: dynamically truncate all tables
	await db.run('DELETE FROM users');
	await db.run('DELETE FROM forms');
	await db.run('DELETE FROM feedbacks');
	await db.run(`
		INSERT INTO users (username, password_hash, admin)
		VALUES ('admin', 'admin', 1)`);
};

// Helper function to update using data object.
// Usage: d.update('users', {'name': 'jon'}, 'username LIKE ?', 'thann');
db.update = async function(table, data, where, ...values) {
	if (!table || !data || !where || !Object.keys(data).length) {
		throw 'Invalid Args!';
	}
	// TODO: escape data keys
	const keys = Object.keys(data).join(' = ? , ') + ' = ?';
	// console.log(
	// 	`UPDATE ${table} SET ${keys} WHERE ${where};`,
	// 	...Object.values(data).map(stringify), ...values);
	return db.run(
		`UPDATE ${table} SET ${keys} WHERE ${where};`,
		...Object.values(data).map(stringify), ...values);
};

// Inteligently calls JSON.stringify on objects
function stringify(s) {
	return s && typeof s === 'object' && JSON.stringify(s) || s;
}
