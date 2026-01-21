# Dockerfile for building EEZ projects with Emscripten
FROM emscripten/emsdk:4.0.20

# Install additional dependencies
RUN apt-get update && \
    apt-get install -y \
    git \
    cmake \
    make \
    wget \
    rsync \
    && rm -rf /var/lib/apt/lists/*

# Download and build freetype with Emscripten
RUN cd /opt && \
    wget https://download.sourceforge.net/freetype/freetype-2.14.1.tar.gz && \
    tar -xzf freetype-2.14.1.tar.gz && \
    cd freetype-2.14.1 && \
    mkdir build && \
    cd build && \
    emcmake cmake .. && \
    emmake make -j$(nproc) && \
    rm -f /opt/freetype-2.14.1.tar.gz

# Set working directory
WORKDIR /project

# Default command
CMD ["/bin/bash"]
