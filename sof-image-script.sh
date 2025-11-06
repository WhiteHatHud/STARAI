#!/bin/sh

# centralised place to change the docker image tagging
IMAGE_TAG="v4.1"

# Set your AWS credentials as environment variables before running this script
# export AWS_ACCESS_KEY_ID=your_access_key_here
# export AWS_SECRET_ACCESS_KEY=your_secret_key_here

# login to ECR (requires both the AWS CLI and docker installed)
if aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin 503561440800.dkr.ecr.ap-southeast-1.amazonaws.com; then

  echo 'login successful!'
  
  # this docker build command can be commented out if you have previously built a docker image with the tag 'latest'
  docker build -t sof-starai-ej154:"${IMAGE_TAG}" .

  # this tags the image sof-starai-ej154 to the remote ECR with the tag latest
  docker tag sof-starai-ej154:"${IMAGE_TAG}" 503561440800.dkr.ecr.ap-southeast-1.amazonaws.com/sof-starai-ej154:"${IMAGE_TAG}"

  # perform the push to the ECR with the image tag latest that was set above
  docker push 503561440800.dkr.ecr.ap-southeast-1.amazonaws.com/sof-starai-ej154:"${IMAGE_TAG}"

else

  echo 'Error with logging in to AWS ECR. Please check your credentials and ensure that Docker is running'

fi
