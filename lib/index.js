const AWS = require('aws-sdk')
const Sharp = require('sharp')
const { map, each } = require('async')

const { getFileType, getFileFormat, format } = require('./helpers')

async function generateThumbnails(file, sizes, optimizeOptions) {
  return map(sizes, async ({ name, resizeOptions }) => {
    let bufferOrStream = file.stream || file.buffer
    const path = `images/${name}/${file.hash}.webp`

    if (file.stream) {
      const transformer = Sharp()
        .toFormat('webp')
        .webp(optimizeOptions.webp)
        .resize(resizeOptions || {})
        .rotate()

      bufferOrStream.pipe(transformer).pipe(bufferOrStream)
    } else {
      const buffer = Sharp(file.buffer)
        .toFormat('webp')
        .webp(optimizeOptions.webp)
        .rotate()
        .toBuffer()

      bufferOrStream = Buffer.from(buffer, 'binary')
    }

    strapi.log.info(`🔄 Generated ${path}`)

    return { bufferOrStream, path, mime: 'image/webp' }
  })
}

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

const upload = ({ imageSizes, optimizeOptions, ...config }) => {
  return async (file, customParameters = {}) => {
    const fileType = getFileType(file)
    const fileFormat = getFileFormat(file)

    let buffers = []
    let bufferOrStream = file.stream || Buffer.from(file.buffer, 'binary')
    let path = `${fileFormat}/${file.hash}${file.ext}`

    if (fileFormat === 'images') {
      if (file.stream) {
        const transformer = Sharp()
          .toFormat('webp')
          .webp(optimizeOptions.webp)
          .rotate()

        bufferOrStream.pipe(transformer).pipe(bufferOrStream)
      } else {
        const buffer = Sharp(file.buffer)
          .toFormat('webp')
          .webp(optimizeOptions.webp)
          .rotate()
          .toBuffer()

        bufferOrStream = Buffer.from(buffer, 'binary')
      }

      path = `${fileFormat}/${fileType}/${file.hash}.webp`
      file.mime = 'image/webp'
      file.ext = '.webp'
      file.name = `${file.name.split('.')[0]}.webp`
    }

    buffers.push({
      bufferOrStream,
      path,
      mime: file.mime,
      isOrigin: true,
    })

    if (fileFormat === 'images' && fileType !== 'thumbnail') {
      const thumbs = await generateThumbnails(
        file,
        imageSizes,
        optimizeOptions.webp,
      )
      buffers = [...buffers, ...thumbs]
    }

    const S3 = getS3Instance(config)
    await each(buffers, async (item) => {
      await S3.upload({
        Key: item.path,
        Body: item.bufferOrStream,
        ACL: 'public-read',
        ContentType: item.mime,
        ...customParameters,
      }).promise()

      strapi.log.info(`✅ Uploaded ${item.path}`)
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
