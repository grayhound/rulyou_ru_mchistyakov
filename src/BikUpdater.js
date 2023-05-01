import BikDownloader from './BikDownloader.js';
import {XMLParser} from 'fast-xml-parser';
import fs from 'fs';
import iconv from 'iconv-lite';

/**
 * Основной класс для обновления Bik.
 */
export default class BikUpdater {
  constructor() {
    this.originalEncoding = 'win1251'; // оригинальная кодировка
    this.requiredEncoding = 'utf8'; // нужная нам кодировка (конечно нужен UTF-8)

    this.ignoreXmlRoot = ['?xml']; // список корневых элементов, который нужно игнорировать.

    this.xmlParserIsArray = [ // нам нужно возвращать Accounts всегда как массив
      "BICDirectoryEntry.Accounts",
    ];

    this.xmlParaserOptions = { // опции xml-парсера. Изначально он игнорирует атрибуты, но они нам нужны.
      ignoreAttributes: false,
      isArray: (name, jpath, isLeafNode, isAttribute) => {
        // разделяем путь
        const jpathSplit = jpath.split('.');
        // убираем рутовый элемент, он может быть рандомный
        jpathSplit.shift();
        // а теперь получаем путь вновь.
        const jpathNew = jpathSplit.join('.');
        if(this.xmlParserIsArray.indexOf(jpathNew) !== -1) return true;
      }
    };

    this.bikDownloader = new BikDownloader(
      'http://www.cbr.ru/s/newbik',
      `${process.cwd()}/downloads`,
    );
  }

  /**
   * Получаем путь к xml-файлу, читаем его, парсим xml
   */
  async run() {
    // обращаемся к BikDownloader, который вернёт путь к xml-файлу.
    const bikXmlPath = await this.bikDownloader.getXmlPath();
    // файл небольшой, меньше 1Мб, так что можно загрузить в память.
    const bikXml = await this.getBikXml(bikXmlPath);
    // запускаем xml-парсер
    const bikParser = new XMLParser(this.xmlParaserOptions);
    const bikJsonData = bikParser.parse(bikXml);

    // а теперь нам нужно получить из текущего JSON нужный массив с результатом.
    const resultJson = this.getBikResult(bikJsonData);

    return resultJson;
  }

  /**
   * Читаем bikXml в виде стрима, декодируем из оригинальной кодировки.
   *
   * @param {string} bikXmlPath - путь до xml файла
   * @returns {<Promise>} - промис, который вернёт декодированый xml.
   */
  getBikXml(bikXmlPath) {
    const originalEncoding = this.originalEncoding;
    return new Promise(function(resolve, reject) {
      let converterStream = iconv.decodeStream(originalEncoding);
      fs.createReadStream(bikXmlPath).pipe(converterStream);

      let body = '';

      converterStream.on('data', function (str) {
        body += str;
      });

      converterStream.on('end', function () {
        resolve(body);
      });

      converterStream.on('error', function() {
        reject();
      });
    });
  }

  /**
   * Получаем массив объектов для записи в БД.
   *
   * @param {array} jsonData - массив, полученный из XML-файла.
   * @return {array} - список объектов для занесения в БД.
   */
  getBikResult(jsonData) {
    const result = [];

    // Попытаемся найти нужный ключ.
    const jsonDataKeys = Object.keys(jsonData);
    let jsonMainKey = '';
    jsonDataKeys.forEach((jsonDataKey) => {
      if (!(jsonDataKey in this.ignoreXmlRoot)) {
        jsonMainKey = jsonDataKey;
      }
    });

    // основной блок
    const mainXml = jsonData[jsonMainKey];
    const bicDirectoryEntries = mainXml['BICDirectoryEntry'];

    // прогоняем по всем `BICDirectoryEntry`
    bicDirectoryEntries.forEach(BICDirectoryEntry => {
      // имя и бик получаем всегда.
      const name = BICDirectoryEntry.ParticipantInfo['@_NameP'];
      const bic =  BICDirectoryEntry['@_BIC'];
      // дальше работаем только если массив `Accounts`
      if (('Accounts' in BICDirectoryEntry)) {
        const accounts = BICDirectoryEntry['Accounts'];
        // для каждого аккаунта добавляем элемент в массив, который может пойти в БД.
        accounts.forEach(account => {
          const corrAccount = account['@_Account'];
          result.push({
            bic, name, corrAccount,
          });
        });
      }
    });

    return result;
  }
}