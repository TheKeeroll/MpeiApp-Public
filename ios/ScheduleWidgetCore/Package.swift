// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ScheduleWidgetCore",
    platforms: [.iOS(.v17), .macOS(.v13)],
    products: [.library(name: "ScheduleWidgetCore", targets: ["ScheduleWidgetCore"])],
    targets: [
        .target(name: "ScheduleWidgetCore"),
        .testTarget(name: "ScheduleWidgetCoreTests", dependencies: ["ScheduleWidgetCore"])
    ]
)
