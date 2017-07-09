(function() {
    'use strict';

    angular.module('application', [
            'ui.router',
            'ngAnimate',

            // mediaMate depencies

            // Required for upload
            'ngFileUpload',
            'file-model',

            // Search and filter
            'smart-table',
            'angular.filter',

            // Visual flair
            '720kb.tooltips',
            'angular-svg-round-progressbar',

            //foundation
            'foundation',
            'foundation.modal',
            'foundation.dynamicRouting',
            'foundation.dynamicRouting.animations'
        ])
        .filter('capitalize', function() {
            return function(input, all) {
                var reg = (all) ? /([^\W_]+[^\s-]*) */g : /([^\W_]+[^\s-]*)/;
                return (!!input) ? input.replace(reg, function(txt) {
                    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
                }) : '';
            }
        })

    .config(config)
        .run(run)
        .constant('appSettings', {
            db: 'http://user:password@XXXXXXXXX/XXXXXXX',

            // s3
            s3: 'https://XXXXXXXX.s3.amazonaws.com/',
            s3Bucket: 'XXXXXXXX',
            s3Url: 'https://s3-XXXXXX.amazonaws.com/XXXXXXXX/',
            accessKey: 'XXXXXXXXXXXXXXXXXXX',
            secretKey: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
            policy: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
            signature: 'XXXXXXXXXXXXXXXXXXXXXXXXXX'
        })
        .directive('stPersist', function() {
            // Prevents smart table from reseting on view change
            return {
                require: '^stTable',
                link: function(scope, element, attr, ctrl) {
                    var nameSpace = attr.stPersist;

                    //save the table state every time it changes
                    scope.$watch(function() {
                        return ctrl.tableState();
                    }, function(newValue, oldValue) {
                        if (newValue !== oldValue) {
                            localStorage.setItem(nameSpace, JSON.stringify(newValue));
                        }
                    }, true);

                    //fetch the table state when the directive is loaded
                    if (localStorage.getItem(nameSpace)) {
                        var savedState = JSON.parse(localStorage.getItem(nameSpace));
                        var tableState = ctrl.tableState();

                        angular.extend(tableState, savedState);
                        ctrl.pipe();

                    }

                }
            }
        })
        .directive("stResetSearch", function() {
            // Clear all filters when rest button is clicked
            return {
                restrict: 'EA',
                require: '^stTable',
                link: function(scope, element, attrs, ctrl) {
                    return element.bind('click', function() {
                        return scope.$apply(function() {
                            var tableState;
                            $("[name='globalSearch']").val('');
                            tableState = ctrl.tableState();
                            tableState.search.predicateObject = {};
                            tableState.pagination.start = 0;

                            return ctrl.pipe();
                        });
                    });
                }
            };
        })
        .controller('upload', ["$scope", "$stateParams", "$http", "$state", "Upload", "appSettings", function($scope, $stateParams, $http, $state, Upload, appSettings) {
            

            // upload

            function parseName() {
                var str = $scope.uploadData.file.name;
                var split_str = str.split('.');

                return split_str[0];
            }

            function parseType() {
                var str = $scope.uploadData.file.type;
                var split_str = str.split('/');

                return [split_str[0], split_str[split_str.length - 1]];
            }

            $scope.fillMetadata = function() {
                // fill fields
                var ud = $scope.uploadData;
                var typeRes = parseType();
                var d = new Date();


                ud.name = parseName();
                ud.fileType = typeRes[0];
                ud.fileExtension = typeRes[1];
                ud.fileSize = ud.file.size;
                ud.lastModifiedDate = ud.file.lastModifiedDate;
                ud.uploadDate = d;
            }

            $scope.uploadFile = function(valid) {
                var file = $scope.uploadData.file;
                $scope.uploading = true;

                // Avoid collisions
                var name = file.name + file.lastModifiedDate;

                if (!valid) {
                    $scope.status = 'Invalid form';
                    $scope.statusStyle = 'warning';
                    return;
                }

                $scope.status = 'Upload has started. Please wait until it is completed.';
                $scope.statusStyle = 'warning';

                // Upload File to S3
                Upload.upload({
                    url: appSettings.s3,
                    method: 'POST',
                    data: {
                        key: name, 
                        AWSAccessKeyId: appSettings.accessKey,
                        acl: 'private', // sets the access to the uploaded file in the bucket
                        policy: appSettings.policy,
                        signature: appSettings.signature,
                        "Content-Type": file.type != '' ? file.type : 'application/octet-stream', // content type of the file (NotEmpty)
                        filename: name, // this is needed for Flash polyfill IE8-9
                        file: file
                    }
                }).then(function(resp) {
                    console.log('Success ' + resp.config.data.file.name + 'uploaded. Response: ' + resp.data);

                    $scope.uploadData.s3Key = name;
                    $scope.uploadData.fileUrl = appSettings.s3Url + name.replace(/ /g, "+");

                    // send post request to CouchDB for metadata
                    $http.post(appSettings.db, $scope.uploadData)
                        .success(function() {
                            $scope.status = 'Success';
                            $scope.statusStyle = 'success';
                            $scope.uploadForm.$setPristine();
                            $scope.uploadData = {};
                            $scope.uploading = false;

                        }).error(function(res) {
                            $scope.status = 'Error: ' + res.reason;
                            $scope.statusStyle = 'warning';
                            $scope.uploading = false;
                        });
                }, function(resp) {
                    console.log('Error status: ' + resp.status);
                }, function(evt) {
                    // Progress bar
                    var progressPercentage = parseInt(100.0 * evt.loaded / evt.total);
                    $scope.progress = progressPercentage;
                    console.log('progress: ' + progressPercentage + '% ' + evt.config.data.file.name);
                });

                
            }

        }])
        .controller('search', ["$scope", "$stateParams", "$http", "$state", "appSettings", function($scope, $stateParams, $http, $state, appSettings) {

            function init() {

                AWS.config.update({accessKeyId: appSettings.accessKey, secretAccessKey: appSettings.secretKey});
                AWS.config.region = 'XXXXXXXX';


                if ($stateParams.id) {
                    // handle details
                    $http.get(appSettings.db + '/' + $stateParams.id)
                        .success(function(res) {
                            $scope.fileData = res;
                        });

                    // update details
                    $scope.updateDoc = function() {
                        $http.put(appSettings.db + '/' + $stateParams.id, JSON.stringify($scope.fileData))
                            .success(function(res) {
                                $state.go('search');
                            });
                    }
                    return;
                }

                // get all records
                $http.get(appSettings.db + '/_design/all/_view/all')
                    .success(function(res) {
                        $scope.searchData = res.rows;
                    });

                // delete file
                $scope.deleteDoc = function(id, rev, s3Key) {
                    var del = confirm('Deleted files cannot be recovered. Press "OK" ONLY if want to proceed with deletion.');

                    if (!del) {
                        return;
                    }

                    var s3 = new AWS.S3();
                    var params = {
                        Bucket: appSettings.s3Bucket,
                        Key: s3Key
                    };

                    // Delete from S3
                    s3.deleteObject(params, function(err, data) {
                        if (err) {
                            console.log(err, err.stack); // error
                        } else {
                            console.log(data); // deleted
                            // Delete from CouchDBA
                            $http.delete(appSettings.db + '/' + id + '?rev=' + rev)
                                .success(function(res) {
                                    $state.go('search', {}, { reload: true });
                                });
                        }
                    });


                }
            }

            init();
        }])
        .controller('details', ["$scope", "$stateParams", "$http", "$state", "appSettings", function($scope, $stateParams, $http, $state, appSettings) {

            $http.get(appSettings.db + '/' + $stateParams.id)
                .success(function(res) {
                    $scope.fileData = res;
                });


        }]);

    config.$inject = ['$urlRouterProvider', '$locationProvider'];

    function config($urlProvider, $locationProvider) {
        $urlProvider.otherwise('/');

        $locationProvider.html5Mode({
            enabled: false,
            requireBase: false
        });

        $locationProvider.hashPrefix('!');
    }

    function run() {
        FastClick.attach(document.body);
    }

})();
