const stream = require('stream')
const AWS = require('aws-sdk')
const Sharp = require('sharp')
const { each } = require('async')

const { getFileType, getFileFormat, format } = require('./helpers')

function getS3BaseUrl({ cdn, params, region }) {
  if (cdn) return cdn

  return format('https://{0}.{1}.digitaloceanspaces.com', [
    params.Bucket,
    region,
  ])
}

function getS3Instance(config) {
  const spacesEndpoint = new AWS.Endpoint(config.endpoint)

  return new AWS.S3({
    apiVersion: '2006-03-01',
    ...config,
    endpoint: spacesEndpoint,
  })
}

const buildUploadImage = (file, type, optimizations, size = {}) => {
  const uploadFile = {
    path: `images/${type}/${file.hash}.webp`,
    mime: 'image/webp',
    stream: !!file.stream,
  }

  if (file.stream) {
    const transformer = Sharp()
      .toFormat('webp')
      .webp(optimizations)
      .resize(size)
      .rotate()

    uploadFile.transformer = transformer
    uploadFile.bufferOrStream = file.stream
  } else {
    const buffer = Sharp(file.buffer)
      .toFormat('webp')
      .webp(optimizations)
      .rotate()
      .toBuffer()

    uploadFile.bufferOrStream = Buffer.from(buffer, 'binary')
  }

  return uploadFile
}

const uploadToS3 = (file, config, customParameters = {}) => {
  const s3 = getS3Instance(config)

  let pass = null
  if (file.stream) pass = new stream.PassThrough()

  return {
    writeStream: pass,
    promise: s3
      .upload({
        Key: file.path,
        Body: file.stream ? pass : file.streamOrBufer,
        ACL: 'public-read',
        ContentType: file.mime,
        ...customParameters,
      })
      .promise(),
  }
}

const upload = ({ imageSizes, optimizeOptions, ...config }) => {
  return async (file, customParameters = {}) => {
    const fileType = getFileType(file)
    const fileFormat = getFileFormat(file)
    const buffers = []
    let path = `${fileFormat}/${file.hash}${file.ext}`

    if (fileFormat === 'images') {
      const uploadFile = buildUploadImage(file, fileType, optimizeOptions.webp)
      path = uploadFile.path
      buffers.push(uploadFile)

      file.mime = 'image/webp'
      file.ext = '.webp'
      file.name = `${file.name.split('.')[0]}.webp`
    } else {
      buffers.push({
        bufferOrStream: file.stream || Buffer.from(file.buffer, 'binary'),
        path,
        mime: file.mime,
        stream: !!file.stream,
      })
    }

    if (fileFormat === 'images' && fileType !== 'thumbnail') {
      for (const { name, resizeOptions: size } of imageSizes)
        buffers.push(buildUploadImage(file, name, optimizeOptions.webp, size))
    }

    await each(buffers, async (item) => {
      try {
        const { writeStream, promise } = uploadToS3(
          item,
          config,
          customParameters,
        )

        if (item.stream) {
          if (item.transformer)
            item.bufferOrStream.pipe(item.transformer).pipe(writeStream)
          else item.bufferOrStream.pipe(writeStream)
        }

        await promise

        strapi.log.info(`✅ Uploaded ${item.path}`)
      } catch (error) {
        strapi.log.info(`❌ Upload failed: ${error.message}`)
      }
    })

    file.url = `${getS3BaseUrl(config)}/${path}`
  }
}

const destroy = ({ imageSizes, ...config }) => {
  return async (file, customParameters = {}) => {
    const fileType = getFileType(file)
    const fileFormat = getFileFormat(file)

    const paths = {
      images: `images/${fileType}/${file.hash}${file.ext}`,
      videos: `videos/${file.hash}${file.ext}`,
      files: `files/${file.hash}${file.ext}`,
      thumbs: `images/{0}/${file.hash}${file.ext}`,
    }

    const S3 = getS3Instance(config)

    const path = paths[fileFormat]
    await S3.deleteObject({ Key: path, ...customParameters }).promise()

    if (fileType !== 'thumbnail') {
      await each(imageSizes, async (size) => {
        const key = format(paths.thumbs, [size.name])
        await S3.deleteObject({ Key: key, ...customParameters }).promise()

        strapi.log.info(`❌ Deleted ${key}`)
      })
    }

    strapi.log.info(`❌ Deleted ${path}`)
  }
}

module.exports = {
  init: (providerOptions) => ({
    uploadStream: upload(providerOptions),
    upload: upload(providerOptions),
    delete: destroy(providerOptions),
  }),
}
