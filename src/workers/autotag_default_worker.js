import * as AWS from 'aws-sdk';
export const AUTOTAG_TAG_NAME_PREFIX = 'AutoTag_';
const AUTOTAG_CREATOR_TAG_NAME = AUTOTAG_TAG_NAME_PREFIX + 'Creator';
const AUTOTAG_CREATE_DATE_TAG_NAME = AUTOTAG_TAG_NAME_PREFIX + 'CreateTime';
const ROLE_PREFIX = 'arn:aws:iam::';
const ROLE_SUFFIX = ':role';
const DEFAULT_STACK_NAME = 'autotag';
const MASTER_ROLE_NAME = 'AutoTagMasterRole';
const MASTER_ROLE_PATH = '/gorillastack/autotag/master/';

class AutotagDefaultWorker {
  constructor(event, s3Region) {
    this.event = event;
    this.s3Region = s3Region;
    this.region = process.env.AWS_REGION;

    // increase the retries for all AWS worker calls to be more resilient
    AWS.config.update({
      retryDelayOptions: {base: 300},
      maxRetries: 8
    });
  }

  /* tagResource
  ** method: tagResource
  **
  ** Do nothing
  */
  tagResource() {
    let _this = this;
    return new Promise((resolve, reject) => {
      try {
        // Do nothing
        resolve(true);
      } catch (e) {
        reject(e);
      }
    });
  }

  getRoleName() {
    let _this = this;
    return new Promise((resolve, reject) => {
      try {
        let cloudFormation = new AWS.CloudFormation({ region: _this.region });
        cloudFormation.describeStackResource({
          StackName: DEFAULT_STACK_NAME,
          LogicalResourceId: MASTER_ROLE_NAME
        }, (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data.StackResourceDetail.PhysicalResourceId);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  assumeRole(roleName) {
    let _this = this;
    return new Promise((resolve, reject) => {
      try {
        AWS.config.region = 'us-east-1';
        let sts = new AWS.STS();
        sts.assumeRole({
          RoleArn: _this.getAssumeRoleArn(roleName),
          RoleSessionName: 'AutoTag-' + (new Date()).getTime(),
          DurationSeconds: 900
        }, (err, data) => {
          if (err) {
            reject(err);
          } else {
            let credentials = {
              accessKeyId: data.Credentials.AccessKeyId,
              secretAccessKey: data.Credentials.SecretAccessKey,
              sessionToken: data.Credentials.SessionToken
            };
            resolve(credentials);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  dumpEventInfo() {
    console.log('Event Name: ' + this.event.eventName);
    console.log('Event Type: ' + this.event.eventType);
    console.log('Event Source: ' + this.event.eventSource);
    console.log('AWS Region: ' + this.event.awsRegion);
    console.log('---');
  }

  logTags(resources, tags) {
    console.log("Tagging " + resources + " with " + JSON.stringify(tags));
  }

  // support for older CloudTrail logs
  getAssumeRoleArn(roleName) {
    let accountId = this.event.recipientAccountId ? this.event.recipientAccountId : this.event.userIdentity.accountId;
    return ROLE_PREFIX + accountId + ROLE_SUFFIX + MASTER_ROLE_PATH + roleName;
  }

  getAutotagTags() {
    return [
      this.getAutotagCreatorTag(),
      this.getAutotagCreateTimeTag()
    ];
  }
  
  getAutotagCreatorTag() {
    return {
      Key: this.getCreatorTagName(),
      Value: this.getCreatorTagValue()
    };
  }

  getAutotagCreateTimeTag() {
    return {
      Key: this.getCreateTimeTagName(),
      Value: this.getCreateTimeTagValue()
    };
  }

  getCreatorTagName() {
    return AUTOTAG_CREATOR_TAG_NAME;
  }

  getCreatorTagValue() {
    return this.event.userIdentity.arn;
  }

  getCreateTimeTagName() {
    return AUTOTAG_CREATE_DATE_TAG_NAME;
  }

  getCreateTimeTagValue() {
    return this.event.eventTime;
  }

};

export default AutotagDefaultWorker;
