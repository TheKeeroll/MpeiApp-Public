const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const flag = process.argv.indexOf('--java-home');
const javaHome = flag >= 0 ? process.argv[flag + 1] : process.env.JAVA_HOME;
if (flag >= 0 && !javaHome) throw new Error('--java-home requires a JDK directory');
const jsonFlag = process.argv.indexOf('--json-jar');
const jsonJar = jsonFlag >= 0 ? process.argv[jsonFlag + 1] : null;
if (jsonFlag >= 0 && (!jsonJar || !fs.existsSync(jsonJar))) throw new Error('--json-jar requires an existing org.json JAR');
const binary = name => javaHome ? path.join(javaHome, 'bin', name + (process.platform === 'win32' ? '.exe' : '')) : name;
const prefix = 'mpei-android-widget-tests-';
const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
try {
  const sources = [
    'android/app/src/main/java/com/mpeiapp/ScheduleWidgetState.java',
    'android/app/src/main/java/com/mpeiapp/ScheduleWidgetData.java',
    'android/app/src/test/java/com/mpeiapp/ScheduleWidgetCoreTest.java',
  ].map(file => path.join(root, file));
  if (jsonJar) sources.push(
    path.join(root, 'android/app/src/main/java/com/mpeiapp/JsonParser.java'),
    path.join(root, 'android/app/src/test/java/com/mpeiapp/ScheduleWidgetParserTest.java'),
  );
  execFileSync(binary('javac'), ['-encoding', 'UTF-8', '--release', '17', '-d', directory, ...(jsonJar ? ['-cp', jsonJar] : []), ...sources], {stdio: 'inherit'});
  const classpath = [directory, ...(jsonJar ? [jsonJar] : [])].join(path.delimiter);
  execFileSync(binary('java'), ['-cp', classpath, 'com.mpeiapp.ScheduleWidgetCoreTest'], {stdio: 'inherit'});
  if (jsonJar) execFileSync(binary('java'), ['-cp', classpath, 'com.mpeiapp.ScheduleWidgetParserTest'], {stdio: 'inherit'});
} finally {
  const resolved = path.resolve(directory);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith(prefix)) {
    throw new Error('Refusing to remove an unexpected test directory');
  }
  fs.rmSync(resolved, {recursive: true, force: true});
}
