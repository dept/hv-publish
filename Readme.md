HV Publish
==========

Within bitbucket pipelines:

```
yarn run build # build your site
npm install -g hv-publish
save2repo
hv-publish
```
Under the assumption of the build directory being at `./build`.

## Combination Strategy (`hv-publish` and `save2repo`)

`hv-publish` and `save2repo` are very often used in conjunction, but the order may vary:

    - hv-publish
    - save2repo

or

    - save2repo
    - hv-publish

The first should be the normal case. But whatever the order, we want to get most out of the combination:

`hv-publish` should
- publish to Netlify
- save the website info to hv.dev
- save the commit info to hv.dev
    - of the source repository
    - and the build repository

`save2repo` should
- commit to another bitbucket git repository
    - the commit message should include the hv.dev index + commit messages

To make sure this works for both order cases, let's take these steps:

### `hv-publish`, then `save2repo`

- hv-publish
    - publish to Netlify
    - save to hv.dev --> `.hv-publish.json`
- save2repo
    - save to repo, use info of `.hv-publish.json` --> .save2repo.json
    - patch hv.dev

### `save2repo`, then `hv-publish`

- save2repo
    - save to repo, use only commit messages --> `.save2repo.json`
- hv-publish
    - publish to Netlify
    - save to hv.dev, use info of `.save2repo.json`
    - update commit message with info of hv-publish

### Combined

- hv-publish
    - publish to Netlify
    - if `.save2repo.json`
        - save to hv.dev with all info
        - update commit message with info from hv.dev
    - else
        - save to hv.dev without build_repo info
        - save result to `.hv-publish.json`

- save2repo
    - if `.hv-publish.json`
        - commit to repo with info from `.hv-publish.json`
        - patch hv.dev with commit info
    - else
        - commit to repo without hv.dev info (no index)
        - save commit info to `.save2repo.json`



