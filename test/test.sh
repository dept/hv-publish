# Set some env variables
BB_AUTH_STRING=

cd hv-publish-testbuild
node build.js
cd ..

node test.js

# Clone a bitbucket repository

# save2repo

# hv-publish