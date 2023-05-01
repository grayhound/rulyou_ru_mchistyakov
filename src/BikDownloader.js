import {createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import fetch from 'node-fetch';
import AdmZip from 'adm-zip';

/**
 * Данный класс занимается скачиваем zip-файла с БИКами и его распаковкой.
 */
export default class BikDownloader {
  /**
   * Конструктор.
   */
  constructor(bik_zip_url, download_path) {
    // Ссылка на zip-файл.
    this.bik_zip_url = bik_zip_url;

    // Путь скачивания файлов.
    this.download_path = download_path;
    this.biz_download_path = `${this.download_path}/bik`;
  }

  /**
   * Проводим все необъодимые действия, чтобы получить путь к xml-файлу.
   *
   * @return {string} путь к xml-файлу.
   */
  async getXmlPath() {
    const zipPath = await this.downloadZip();

    // Открываем зип-файл и получаем список файлов.
    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();
    // должен быть только один файл.
    if (zipEntries.length !== 1) {
      throw new Error(`Unexpected amount of files in the zip-archive. It should be only one XML-file.`);
    }
    const xmlFilename = zipEntries[0].name;
    // распаковываем zip
    zip.extractAllTo(this.biz_download_path, true);

    return `${this.biz_download_path}/${xmlFilename}`;
  }

  /**
   * Скачиваем zip-файл с БИКам.
   * Сделаем это через пайплайн, хоть файл и небольшой.
   *
   * @return {string} Путь к скачаному файлу.
   */
  async downloadZip() {
    const response = await fetch(this.bik_zip_url);
    // если ошибка - выкидываем исключение.
    if (!response.ok) {
      throw new Error(`Unexpected response ${response.statusText}`);
    }
    // нужно получить имя файла из хэдеров.
    const filename = this.getFilenameFromHeaders(response.headers);
    const filepath = `${this.biz_download_path}/${filename}`;

    // теперь скачиваем сам файл
    await pipeline(response.body, createWriteStream(filepath));

    return filepath;
  }

  /**
   * Получаем filename из хэдеров.
   *
   * @param {Array} headers список заголовков из ответа
   * @returns {string} имя файла из заголовка
   */
  getFilenameFromHeaders(headers) {
    return headers.get('content-disposition')
      .split(';')
      .find(n => n.includes('filename='))
      .replace('filename=', '')
      .trim();
  }
}
