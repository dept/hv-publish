#!/bin/bash

# Set some env variables
export $(grep -v '^#' .env | xargs)

rm -rf hv-publish-testbuild
rm -rf repo

# Clone a bitbucket repository
# let's get our small test project
git clone https://$BB_AUTH_STRING@bitbucket.org/${BITBUCKET_REPO_OWNER}/${BITBUCKET_REPO_SLUG}.git

# build the test project (changes, deletes, adds some files)
cd hv-publish-testbuild
node build.js


# save2repo
../../bin/save2repo

# hv-publish
../../bin/hv-publish.js