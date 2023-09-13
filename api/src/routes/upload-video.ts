
import { promisify } from 'node:util';
import { FastifyInstance } from 'fastify';
import { fastifyMultipart } from '@fastify/multipart';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream';
import fs from 'node:fs';
import { prisma } from '../lib/prisma';

const pump = promisify(pipeline);
 
export async function uploadVideoRoute(app: FastifyInstance) {
  app.register(fastifyMultipart, {
    limits: {
      fileSize: 1_048_576 * 25,  // 25mb
    },
  });

  app.post('/videos', async (request, response) => {
    const data = await request.file();

    if (!data) {
      return response.status(400).send({ error: 'Missing file input' });
    };

    const extension = path.extname(data.filename);

    // para que apenas arquivos mp3 possam ser carregados
    if (extension !== '.mp3') {
      return response.status(400).send({ error: 'Invalid input type! Please upload a MP3.' });
    };

    const fileBaseName = path.basename(data.filename, extension);

    // example.mp3
    // example
    const fileUploadName = `${fileBaseName}-${randomUUID()}${extension}`;

    const uploadDestination = path.resolve(__dirname, '../../tmp', fileUploadName);

    // a medida que os dados do arquivo são recebidos aos poucos, esses dados são escritos aos poucos também  
    await pump(data.file, fs.createWriteStream(uploadDestination));

    const video = await prisma.video.create({
      data: {
        name: data.filename,
        path: uploadDestination,
      },
    });
    
    return { video };
  });
};
