# mediaMate
*Stefan Zecevic (xlegs231@gmail.com)* -
*June 2016*

## Introduction

This app is built on [Foundation for Apps](http://foundation.zurb.com/apps.html) (v1.1.0  at the time of writing), a frontend responsive [AngularJS](https://angularjs.org/) (v1) framework.

Web development moves quickly, so keep the above version numbers in mind to avoid compatibility issues (especially with regards to dependencies).

The files themselves are stored in Amazon S3 while the metadata is stored in CouchDB, which can be run in an Amazon EC2 instance.

This app is best used on a modern Firefox or Chrome install.

## Security Concerns

This app is written in javascript. Therefore, any passwords and keys are visible to the client. **Exposing this app to the public can grant anyone read/write access to the CouchDB and S3 servers. Make sure the app is deployed internally.**

## Development Environment

For mediaMate, we require:

- [Foundation for Apps](http://foundation.zurb.com/apps.html): A frontend responsive AngularJS framework
  - [Node.js](http://nodejs.org): A JavaScript runtime which includes `npm` (node package manager)
  - [Git](http://git-scm.com/downloads): Version Control, but mostly used for cloning repos
  - [Gulp](http://gulpjs.com/): A JavaScript build system
  - [Bower](http://bower.io): A package manager for webapps (Tip: Always use `bower install <pkg> --save`)

Change into the directory.

```bash
cd mediaMate
```

Install the dependencies. If you're running Mac OS or Linux, you may need to run `sudo npm install` instead, depending on how your machine is configured.

```bash
npm install
bower install
```

While you're working on your project, run:

```bash
npm start
```

This will compile the Sass and assemble your Angular app. **Now go to `localhost:8080` in your browser to see it in action.** When you change any file in the `client` folder, the appropriate Gulp task will run to build new files.

To run the compiling process once, without watching any files, use the `build` command.

```bash
npm start build
```

### Directory Structure

    mediaMate
    ├── bower_components 
    ├── bower.json
    ├── build (Compiled app ends up here)
    ├── client (The actual app resides here)
    ├── docs
    ├── etc
    ├── gulpfile.js (Think of this as a makefile. Modify this when adding new js/css files)
    ├── node_modules
    └── package.json

```lang-none
mediaMate/client
├── assets
│   ├── js
│   │   └── app.js (All AngularJS code is here. All dependencies are imported here, too.)
│   └── scss (SASS is compiled into css on build)
│       ├── app.scss (Imports)
│       ├── _mediamate.scss (App styles)
│       └── _settings.scss (Foundation settings)
├── index.html (Global HTML -- headers/footers)
└── templates (one per view)
    ├── details.html
    ├── home.html
    └── upload.html
```

Upon build, all the js and scss files are concatenated and minified. Angular routes are built, too. The resulting files end up in `mediaMate/build`.

### Foundation vs Vanilla AngularJS

Foundation does many things a little differently compared to vanilla Angular, so refer to the [Foundation Docs](http://foundation.zurb.com/apps/docs/#!/).

Some pointers:

- Always look for a Bower or npm package of any libraries you need.
- Include new libs/css in the gulpfile (Don't forget restart the watch/build script).
- The [Foundation Docs](http://foundation.zurb.com/apps/docs/#!/) are indispensible. 
- Many bower packages are on GitHub. Search those docs and bug reports for answers.

### CouchDB

If you're not already familiar with CouchDB, start by installing it on your local machine before moving on to a cloud deployment.

#### Web Interface

The CouchDB WebUI is useful for learning and configuring CouchDB. 

On a local install, access it at http://localhost:5984/_utils.

The cloud deployment uses a different URL.

#### The CouchDB API

CouchDB is a NoSQL datastore. Basically, the client (mediaMate) sends an HTTP request and CouchDB returns a JSON document. The [CouchDB API](http://docs.couchdb.org/en/1.6.1/intro/api.html) is how mediaMate communicates with CouchDB.

#### CORS

In order for mediaMate to work with CouchDB, [CORS must be enabled](https://github.com/pouchdb/add-cors-to-couchdb). 

The config `cors/origins: *` as seen in CouchDB's WebUI config page allows **all** IP addresses/domains to send requests. **In a production environment, it is recommended to allow only authorized domains.**

#### Admin Party

By default, CouchDB allows anonymous admin access. On a local CouchDB install for dev purposes, this is fine. Production deployments of mediaMate should be [secured](https://cwiki.apache.org/confluence/display/COUCHDB/Securing+CouchDB).

#### Configuring mediaMate

In the declaration of `appSettings` in `app.js`, change the value of `db` to `http://<user>:<password>@<address>/mediamate`. 

Make sure a `mediamate` database exists on the server.

For servers with anonymous admin access, `<user>:<password>` is not needed.

## Deploying to Amazon Web Services (AWS)

This app is deployed to [Amazon Web Services](https://aws.amazon.com/). An account is required. New accounts can deploy this app free for a year on Amazon's [free tier](https://aws.amazon.com/free/).

After you create an account, [create an IAM user](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSGettingStartedGuide/AWSAccounts.html). This will be important later.

### File Storage: AWS S3

Create a bucket with the name of your choice.

#### Configuring mediaMate

In the declaration of `appSettings` in `app.js`, change the values as appropriate:

- **s3**: `https://<bucket_name>.s3.amazonaws.com/`
  - *Note:*: You can point an external domain or subdomain to the s3 bucket, and use that URL instead.
- **s3Bucket**: `<bucket_name>`
- **s3Url**: `https://s3-<region_name>.amazonaws.com/<bucket_name>/`
  - The region name can be found in the URL when viewing your bucket on `console.aws.amazon.com`.
- **accessKey**: Instructions for creating the access and secret keys are [here](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSGettingStartedGuide/AWSCredentials.html).
- **secretKey**: See above
- **policy**: See next section
- **signature**: See above

In the `search` controller the line:
```
AWS.config.region = 'XXXXXXXX';
```
should be filled appropriately.


##### Obtaining the Policy and Signature

 1. Go to [this page](https://angular-file-upload.appspot.com/) and scroll to the bottom.
 1. Click on the button marked `S3 Policy Signing Helper`
 1. Enter your AWS Secret Key
 1. Enter the JSON policy:
 ```json
 {
   "expiration": "2020-01-01T00:00:00Z",
   "conditions": [
     {"bucket": <bucket_name>},
     ["starts-with", "$key", ""],
     {"acl": "private"},
     ["starts-with", "$Content-Type", ""],
     ["starts-with", "$filename", ""],
     ["content-length-range", 0, 524288000]
   ]
 }
 ```
 1. Click `Sign`
 1. The policy and signature will appear above the button marked `S3 Policy Signing Helper`.

### Bucket Policy and CORS on S3

Make sure that you provide upload and CORS post to your bucket at AWS -> S3 -> `<bucket_name>` -> Properties -> Permissions -> Edit bucket policy and Edit CORS Configuration.

#### Bucket Policy

```json
{
    "Id": "Policy1462899912644",
    "Version": "2012-10-17",
    "Statement": [{
        "Sid": "Stmt1462899909973",
        "Action": [
            "s3:DeleteObject",
            "s3:PutObject"
        ],
        "Effect": "Allow",
        "Resource": "arn:aws:s3:::<bucket_name>/*",
        "Principal": {
            "AWS": [
                "<user_arn>"
            ]
        }
    }, {
        "Sid": "AddPerm",
        "Effect": "Allow",
        "Principal": "*",
        "Action": ["s3:GetObject"],
        "Resource": ["arn:aws:s3:::<bucket_name>/*"]
    }]
}
```

`<user_arn>` can be found at AWS -> IAM -> Users -> `<iam_user>`.


#### CORS Configuration
```xml
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
    <CORSRule>
        <AllowedOrigin>*</AllowedOrigin>
        <AllowedMethod>POST</AllowedMethod>
        <AllowedMethod>GET</AllowedMethod>
        <AllowedMethod>HEAD</AllowedMethod>
        <AllowedMethod>DELETE</AllowedMethod>
        <MaxAgeSeconds>3000</MaxAgeSeconds>
        <AllowedHeader>*</AllowedHeader>
    </CORSRule>
</CORSConfiguration>
```

The line `<AllowedOrigin>*</AllowedOrigin>` allows **all** IP addresses/domains to send requests. **In a production environment, it is recommended to allow only authorized domains.**

### Metadata Storage: TurnKey, Amazon EC2, and CouchDB

[TurnKey Linux Hub](https://hub.turnkeylinux.org/) allows for easy deployment of ready-made EC2 images.

Create an account and link it to your AWS account. 

Launch a new TurnKey CouchDB appliance. A T2.Micro instance is plenty. 

Configuration is identical to the above CouchDB instructions but with 2 exceptions:
- The WebUI runs on port 80
- A domain should point to the Couch server.

