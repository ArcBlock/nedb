LAST_COMMIT_MESSAGE=$(git log -1 --pretty=%B | cat)
SKIP_MARK="[skip travis]"
if [[ "$LAST_COMMIT_MESSAGE" == *"$SKIP_MARK"* ]]; then
  echo "Do nothing because we have published already or marked as skip travis."
  exit 0
fi

git config --local user.name "wangshijun"
git config --local user.email "wangshijun2010@gmail.com"

git remote remove origin
git remote add origin "https://$GITHUB_TOKEN@github.com/$TRAVIS_REPO_SLUG.git"
git remote -v
git pull origin master
git branch -a

CHANGED=$(lerna changed --force-publish)
echo "lerna changed ${CHANGED}"
if [ "$CHANGED" != "" ]; then
  git checkout master
  git commit -am "[skip travis] update yarn.lock file"

  # publish
  npm config set '//registry.npmjs.org/:_authToken' "${NPM_TOKEN}"
  VERSION=$(cat version | awk '{$1=$1;print}')
  echo "publish version ${VERSION}"
  lerna publish $VERSION --force-publish --yes

  # trigger cnpm sync
  node tools/post-publish.js
  git checkout .

  # update readme
  node tools/update-readme.js
  git add README.md
  git commit -m '[skip travis] update readme'
  git push origin master

  # tagging for docker hub ci
  DOCKER_TAG=docker-$VERSION
  git tag -a $DOCKER_TAG -m "Tag $DOCKER_TAG for Docker Hub."
  git push origin $DOCKER_TAG
fi
