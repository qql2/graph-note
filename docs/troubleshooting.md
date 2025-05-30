# 故障排除指南

## Android Gradle Plugin (AGP) 与 Java 版本兼容性问题

### 问题描述
在使用 Java 21 或更高版本时，如果 Android Gradle Plugin (AGP) 版本低于 8.2.1，构建过程会失败。这是 AGP 的一个已知 bug。

错误信息：
```
This is likely due to a known bug in Android Gradle Plugin (AGP) versions less than 8.2.1, when
1. setting a value for SourceCompatibility and
2. using Java 21 or above.
```

### 原因
这是 AGP 在处理 Java 21+ 的 SourceCompatibility 设置时的一个已知问题。详见：
- [Google Issue Tracker #294137077](https://issuetracker.google.com/issues/294137077)
- [Flutter Issue #156304](https://github.com/flutter/flutter/issues/156304)

### 解决方案
在 `android/settings.gradle` 中更新 AGP 版本至 8.2.1 或更高：

```gradle
plugins {
    id "dev.flutter.flutter-plugin-loader" version "1.0.0"
    id "com.android.application" version "8.2.1" apply false  // 更新此版本
    id "org.jetbrains.kotlin.android" version "1.8.22" apply false
}
```

### 相关配置检查清单
确保以下文件的配置相互兼容：

1. **android/settings.gradle**
   - AGP 版本 >= 8.2.1
   - Kotlin 版本兼容性检查

2. **android/app/build.gradle**
   - Java 和 Kotlin 编译选项设置正确
   ```gradle
   compileOptions {
       sourceCompatibility JavaVersion.VERSION_17
       targetCompatibility JavaVersion.VERSION_17
   }
   kotlinOptions {
       jvmTarget = '17'
   }
   ```

3. **android/gradle/wrapper/gradle-wrapper.properties**
   - Gradle 版本与 AGP 版本兼容
   ```properties
   distributionUrl=https\://services.gradle.org/distributions/gradle-8.2.1-all.zip
   ```

### 其他可能需要的操作
如果更新后仍然遇到问题，可以尝试：

1. 清理项目缓存：
```bash
flutter clean
```

2. 删除 Gradle 缓存：
```bash
rm -rf $HOME/.gradle/caches/
```

3. 重新获取依赖并运行：
```bash
flutter pub get
flutter run
```

### 参考链接
- [AGP 版本兼容性文档](https://developer.android.com/studio/releases/gradle-plugin)
- [Gradle 与 AGP 兼容性矩阵](https://developer.android.com/studio/releases/gradle-plugin#updating-gradle)
- [Java 版本兼容性指南](https://docs.gradle.org/current/userguide/compatibility.html) 