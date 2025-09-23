#!/bin/bash

# Script to work with docker images.

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No color.

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Log functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1" 
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

help() {
  echo ""
  echo -e "${BLUE}Starlight${NC}"
  echo "Commands:"
  echo "  -s, --starlight Build image and start starlight container."
  echo "  -r, --redis     Start redis container." 
  echo "  -c, --clean     Remove all related images."
  echo "" 
  exit 0
}

check_docker() {
  log_info "Checking docker service..."
  if ! command -v docker &> /dev/null; then
    log_error "You have not installed Docker."
    exit 1
  fi

  if ! docker info &> /dev/null; then
    log_error "Docker service is not running."
    exit 1
  fi

  log_info "Docker service check passed."
  return 0
}

build_starlight() {
  log_info "Building starlight image..."

  cd "$PROJECT_ROOT"
  
  docker build \
      -f Dockerfile.dev \
      -t starlight:latest \
      .

  if [ $? -eq 0 ]; then
    log_success "Build image succeeded."
    return 0
  else
    log_error "Failed to build starlight image."
    return 1
  fi
}

start_starlight() {
  log_info "Starting starlight container..."
  
  if docker ps -a --format 'table {{.Names}}' | grep -q "^starlight$"; then
    log_info "Removing existing starlight container..."
    docker stop starlight 2>/dev/null || true
    docker rm starlight 2>/dev/null || true
  fi

  docker run \
    --name starlight \
    -d \
    --network starlight \
    starlight:latest

  if [ $? -eq 0 ]; then
    log_success "Starlight container started."
    return 0
  else
    log_error "Failed to start startlight container."
    return 1
  fi
}

start_redis() {
  log_info "Starting redis..."
  
  if docker ps -a --format 'table {{.Names}}' | grep -q "redis-starlight"; then
    log_info "Removing existing redis container..."
    docker stop redis-starlight 2>/dev/null || true
    docker rm redis-starlight 2>/dev/null || true
  fi

  docker run \
    -d \
    --name redis-starlight \
    -p 127.0.0.1:6379:6379 \
    --network starlight \
    redis:latest
  
  if [ $? -eq 0 ]; then
    log_success "Redis container has started."
    return 0
  else
    log_error "Failed to start redis container."
    return 1
  fi
}

clean_all() {
  log_info "Cleaning process started..."

  log_info "Checking all containers related..."
  docker stop $(docker ps -q --filter "ancestor=starlight:latest" 2>/dev/null) 2>/dev/null || true
  docker stop $(docker ps -q --filter "name=redis-starlight" 2>/dev/null) 2>/dev/null || true

  log_info "Removing all containers related..."
  docker rm $(docker ps -aq --filter "ancestor=starlight:latest" 2>/dev/null) 2>/dev/null || true
  docker rm $(docker ps -aq --filter "name=redis-starlight" 2>/dev/null) 2>/dev/null || true

  log_info "Removing images..."
  docker rmi starlight:latest 2>/dev/null || true

  log_info "Removing network..."
  docker network rm starlight

  log_success "Cleaning process completed..."
  return 0
}

create_starlight_network () {
  log_info "Checking network..."
  if docker network ls --format 'table {{.Name}}' | grep "^starlight$"; then
    return 0
  fi
  docker network create starlight
  log_success "Starlight network created."
  return 0
}

REDIS_CONTAINER=false
CLEAN_ALL_IMAGES=false
STARLIGHT_CONTAINER=false

while [ "$1" != "" ]; do
  case $1 in
    -h | --help )
      help
      ;;
    -s | --starlight )
      STARLIGHT_CONTAINER=true
      ;;
    -c | --clean )
      CLEAN_ALL_IMAGES=true
      ;;
    -r | --redis )
      REDIS_CONTAINER=true
      ;;
    * )
      log_error "Unrecognized command: $1"
      help
      ;;
  esac
  shift
done

check_docker
create_starlight_network

if [ "$STARLIGHT_CONTAINER" = true ]; then
  if build_starlight; then
    start_starlight
    exit $?
  else
    log_error "Cannot start starlight container because build failed."
    exit 1
  fi
fi

if [ "$REDIS_CONTAINER" = true ]; then
  start_redis
  exit $?
fi

if [ "$CLEAN_ALL_IMAGES" = true ]; then
  clean_all
  exit $?
fi

exit 0
