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
  echo -e "${BLUE}Starlight${NC}"
  echo "Commands:"
  echo "  -s, --starlight Build starlight image."
  echo "  -c, --clean     Remove all related images."
  exit 0
}

check_docker() {
  log_info "Checking docker service..."
  if ! command -v docker &> /dev/null; then
    log_error "You have not installed Docker."
    return 1
  fi

  if ! docker info &> /dev/null; then
    log_error "Docker service is not running."
    return 1
  fi

  log_info "Docker service check passed."
  return 0
}

build_starlight () {
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

STARLIGHT_IMAGE=false
CLEAN_IMAGE=false

while [ "$1" != "" ]; do
  case $1 in
    -h | --help )
      help
      ;;
    -s | --starlight )
      STARLIGHT_IMAGE=true
      ;;
    * )
      log_error "Unrecognized command: $1"
      help
      ;;
  esac
  shift
done

check_docker
 
if [ "$STARLIGHT_IMAGE" = true ]; then
  build_starlight
  exit $?
fi

exit 0
