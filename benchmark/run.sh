
echo "*** Building blockdom ****************************************************"
npm run build

echo "*** Copying files ********************************************************"
mkdir -p ../js-framework-benchmark/frameworks/keyed/blockdom
cp -r benchmark/* ../js-framework-benchmark/frameworks/keyed/blockdom
cp dist/blockdom.iife.js ../js-framework-benchmark/frameworks/keyed/blockdom/blockdom.js

