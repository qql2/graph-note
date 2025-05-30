# Gradle 镜像源配置指南

为了提高 Gradle 依赖下载速度，我们可以将默认的下载源替换为国内镜像源。以下是具体的配置方法：

## 1. 修改 Gradle Wrapper 配置

在 `android/gradle/wrapper/gradle-wrapper.properties` 文件中，将 `distributionUrl` 修改为以下镜像源之一：

### 腾讯云镜像（推荐） 

```
distributionUrl=https\://mirrors.cloud.tencent.com/gradle/gradle-8.2.1-all.zip
```

### 阿里云镜像

```
distributionUrl=https\://maven.aliyun.com/repository/gradle-public/org/gradle/gradle-8.2.1/gradle-8.2.1-all.zip
```
