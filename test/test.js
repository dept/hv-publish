const sync = require('../lib/sync')

sync('hv-publish-testbuild', 'repo', { ignore: ['.git', '.gitignore'] })
