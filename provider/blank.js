module.exports = {
	identify() {
		return true;
	},
	getOptions() {
		return {};
	},
	async getRepository(options) {
		throw new Error('You must provide a valid destination repository.');
	}
};
