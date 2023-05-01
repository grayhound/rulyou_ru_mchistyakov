import BikUpdater from './src/BikUpdater.js';

/**
 * Команда для запуска.
 */
async function RunCommand() {
  const task = new BikUpdater();
  const result = await task.run();
}

/**
 * Запускаем команду и ждём её заврещения.
 * После чего прибиваем процесс.
 */
RunCommand().then(() => {
  console.log(`Command 'main.js' finished`);
  process.exit();
});